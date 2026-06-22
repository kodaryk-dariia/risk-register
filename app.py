from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import numpy as np
from scipy.stats import beta, norm
from itertools import chain, combinations
import io
import os

app = Flask(__name__)

# ── core math (domain-agnostic) ───────────────────────────────────────────

def beta_params(mu, var):
    if pd.isna(mu) or pd.isna(var) or mu <= 0 or mu >= 1 or var <= 0:
        return np.nan, np.nan
    common = (mu * (1 - mu)) / var - 1
    if common <= 0:
        return np.nan, np.nan
    return mu * common, (1 - mu) * common

def sample_beta_val(alpha, beta_val):
    if pd.isna(alpha) or pd.isna(beta_val) or alpha <= 0 or beta_val <= 0:
        return np.nan
    return float(beta.rvs(alpha, beta_val))

def classify_risk_level(risk, threshold):
    p = risk / threshold
    if p < 0.1:   return 'low'
    elif p < 0.3: return 'low-medium'
    elif p < 0.5: return 'medium'
    elif p < 0.7: return 'medium-high'
    else:          return 'high'

LAMBDA = {'low': 0.1, 'low-medium': 0.3, 'medium': 0.5, 'medium-high': 0.7, 'high': 0.9}

def all_subsets(ids):
    return list(chain.from_iterable(combinations(ids, r) for r in range(len(ids) + 1)))

# ── parsing ──────────────────────────────────────────────────────────────

def parse_threats(data):
    threats = []
    for item in data:
        try:
            L  = float(item['likelihood'])
            hm = float(item['harm_mean'])
            hv = float(item['harm_variance'])
            if not (0 < L < 1 and 0 < hm < 1 and hv > 0):
                continue
            a, b_ = beta_params(hm, hv)
            threats.append({
                'id': str(item['id']).strip(),
                'label': item.get('label', ''),
                'L': L, 'harm_alpha': a, 'harm_beta': b_,
                'is_new': bool(item.get('is_new', False)),
            })
        except (KeyError, ValueError, TypeError):
            continue
    return threats

def parse_mitigations(data):
    mitigations = []
    z95 = norm.ppf(0.95)
    for item in data:
        try:
            cmin = float(item['cost_min'])
            cmax = float(item['cost_max'])
            em   = float(item['eff_mean'])
            ev   = float(item['eff_variance'])
            if cmin <= 0 or cmax <= cmin or not (0 < em < 1) or ev <= 0:
                continue
            sigma = (np.log(cmax) - np.log(cmin)) / (2 * z95)
            mu = np.log(cmin) + sigma * z95
            a, b_ = beta_params(em, ev)
            mitigations.append({
                'id': str(item['id']).strip(),
                'label': item.get('label', ''),
                'cost_mu': mu, 'cost_sigma': sigma,
                'eff_alpha': a, 'eff_beta': b_,
                'already_implemented': bool(item.get('already_implemented', False)),
            })
        except (KeyError, ValueError, TypeError):
            continue
    return mitigations

def parse_mapping(data):
    m = {}
    for row in data:
        t = str(row.get('threat', '')).strip()
        mit = str(row.get('mitigation', '')).strip()
        if t and mit:
            m.setdefault(t, []).append(mit)
    return m

# ── simulation engine ────────────────────────────────────────────────────
# mode 'design'   -> every control is a candidate; cost counted for all chosen
# mode 'baseline' -> controls flagged already_implemented are FORCED into every
#                    subset and their cost is excluded from the comparison
#                    (sunk cost); only candidate (new/proposed) controls vary.

def run_simulation(threats, mitigations, mapping, threshold, mode='design'):
    forced = [m['id'] for m in mitigations if mode == 'baseline' and m['already_implemented']]
    candidates = [m['id'] for m in mitigations if not (mode == 'baseline' and m['already_implemented'])]

    subsets = all_subsets(candidates)
    results = []

    for cand_subset in subsets:
        subset = tuple(sorted(set(cand_subset) | set(forced)))

        sampled_threats = []
        for t in threats:
            H = sample_beta_val(t['harm_alpha'], t['harm_beta'])
            if pd.isna(H):
                continue
            sampled_threats.append({**t, 'H': H})

        sampled_mit = {}
        for m in mitigations:
            E = sample_beta_val(m['eff_alpha'], m['eff_beta'])
            C = np.random.lognormal(m['cost_mu'], m['cost_sigma']) if m['cost_sigma'] > 0 else np.nan
            sampled_mit[m['id']] = {'E': E if not pd.isna(E) else 0, 'C': C if not pd.isna(C) else 0}

        valid = True
        threat_results = []
        for t in sampled_threats:
            mapped = mapping.get(t['id'], [])
            active = [mid for mid in mapped if mid in subset]
            factor = 1.0
            for mid in active:
                factor *= (1 - sampled_mit.get(mid, {'E': 0})['E'])
            R = t['L'] * factor * t['H']
            if R > threshold:
                valid = False
                break
            threat_results.append({'id': t['id'], 'label': t.get('label', ''),
                                    'L': round(t['L'], 3), 'H': round(t['H'], 3),
                                    'R': round(R, 4), 'is_new': t.get('is_new', False)})

        if not valid:
            continue

        # cost: in baseline mode, only candidate (non-forced) controls count
        # toward "cost of this decision" — forced ones are sunk and already paid.
        costed_ids = [mid for mid in subset if mid in candidates] if mode == 'baseline' else list(subset)
        total_cost = sum(sampled_mit[mid]['C'] for mid in costed_ids if mid in sampled_mit)
        total_risk = sum(r['R'] for r in threat_results)

        breakdown = {k: 0 for k in LAMBDA}
        for r in threat_results:
            breakdown[classify_risk_level(r['R'], threshold)] += 1
        rsi = sum(LAMBDA[lv] * cnt for lv, cnt in breakdown.items())

        new_controls = [mid for mid in subset if mid in candidates]
        results.append({
            'subset': list(subset),
            'subset_str': ', '.join(subset) if subset else 'None',
            'new_controls_str': ', '.join(new_controls) if new_controls else 'None',
            'forced_str': ', '.join(forced) if forced else 'None',
            'total_cost': round(total_cost, 2),
            'total_risk': round(total_risk, 4),
            'rsi': round(rsi, 3),
            'breakdown': breakdown,
            'threats': threat_results,
        })

    results.sort(key=lambda x: x['rsi'])
    return results

# ── routes: pages ────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/case-study/healthcare')
def case_study_healthcare():
    return render_template('case_study_healthcare.html')

@app.route('/simulate')
def simulate_page():
    return render_template('simulate.html')

@app.route('/feedback', methods=['GET', 'POST'])
def feedback_page():
    if request.method == 'GET':
        return render_template('feedback.html', sent=False, error=None)

    name    = request.form.get('name', '').strip()[:120]
    email   = request.form.get('email', '').strip()[:200]
    ftype   = request.form.get('type', 'General comment')
    message = request.form.get('message', '').strip()[:4000]

    if not message:
        return render_template('feedback.html', sent=False, error='Message cannot be empty')

    try:
        import smtplib
        from email.mime.text import MIMEText

        smtp_user = os.environ.get('MAIL_USER', '')
        smtp_pass = os.environ.get('MAIL_PASS', '')

        if not smtp_user or not smtp_pass:
            # No credentials configured — save to a local log as fallback
            with open('/tmp/feedback.log', 'a', encoding='utf-8') as f:
                f.write(f"---\nFrom: {name} <{email}>\nType: {ftype}\n{message}\n")
            return render_template('feedback.html', sent=True, error=None)

        body = f"Type: {ftype}\nFrom: {name or 'anonymous'} ({email or 'no email'})\n\n{message}"
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = f'[Optimal Control Sets] {ftype}'
        msg['From']    = smtp_user
        msg['To']      = smtp_user
        if email:
            msg['Reply-To'] = email

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
            s.login(smtp_user, smtp_pass)
            s.send_message(msg)

        return render_template('feedback.html', sent=True, error=None)

    except Exception as e:
        return render_template('feedback.html', sent=False, error=str(e))

# ── routes: API ──────────────────────────────────────────────────────────

@app.route('/api/simulate', methods=['POST'])
def simulate():
    body = request.get_json(force=True)
    threshold = float(body.get('threshold', 0.07))
    mode = body.get('mode', 'design')
    threats     = parse_threats(body.get('threats', []))
    mitigations = parse_mitigations(body.get('mitigations', []))
    mapping     = parse_mapping(body.get('mapping', []))

    if not threats:
        return jsonify({'error': 'No valid threat rows. Each needs an ID, likelihood (0–1), harm mean (0–1) and harm variance (>0).'}), 400
    if not mitigations:
        return jsonify({'error': 'No valid control rows. Each needs an ID, cost min/max and effectiveness mean/variance.'}), 400

    try:
        results = run_simulation(threats, mitigations, mapping, threshold, mode)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    n_candidates = len([m for m in mitigations if not (mode == 'baseline' and m['already_implemented'])])
    return jsonify({
        'mode': mode,
        'total_subsets': 2 ** n_candidates,
        'accepted': len(results),
        'threshold': threshold,
        'results': results[:50],
    })

@app.route('/api/export', methods=['POST'])
def export():
    body = request.get_json(force=True)
    results = body.get('results', [])
    if not results:
        return jsonify({'error': 'No results to export'}), 400
    rows = []
    for r in results:
        rows.append({
            'Mitigation Subset': r['subset_str'],
            'New/Proposed Controls': r.get('new_controls_str', ''),
            'Already-Implemented (sunk)': r.get('forced_str', ''),
            'Total Cost': r['total_cost'],
            'Total Risk': r['total_risk'],
            'RSI': r['rsi'],
            'Low': r['breakdown']['low'],
            'Low-Medium': r['breakdown']['low-medium'],
            'Medium': r['breakdown']['medium'],
            'Medium-High': r['breakdown']['medium-high'],
            'High': r['breakdown']['high'],
        })
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return send_file(buf, mimetype='text/csv', as_attachment=True, download_name='risk_results.csv')

# ── Excel template + upload ─────────────────────────────────────────────

TEMPLATE_COLUMNS = {
    'Threats': ['ID', 'Label', 'Likelihood (0-1)', 'Harm Mean (0-1)', 'Harm Variance',
                'Is New Threat? (yes/no)', 'Source / Justification (optional)'],
    'Controls': ['ID', 'Label', 'Cost Min ($)', 'Cost Max ($)', 'Effectiveness Mean (0-1)',
                 'Effectiveness Variance', 'Already Implemented? (yes/no)', 'Source / Justification (optional)'],
    'Mapping': ['Threat ID', 'Control ID'],
}

@app.route('/api/template')
def download_template():
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine='openpyxl') as writer:
        pd.DataFrame(columns=TEMPLATE_COLUMNS['Threats']).to_excel(writer, sheet_name='Threats', index=False)
        pd.DataFrame(columns=TEMPLATE_COLUMNS['Controls']).to_excel(writer, sheet_name='Controls', index=False)
        pd.DataFrame(columns=TEMPLATE_COLUMNS['Mapping']).to_excel(writer, sheet_name='Mapping', index=False)
        # example row sheet for guidance
        example = pd.DataFrame([{
            'ID': 'T-1', 'Label': 'Spoofing — Sensor', 'Likelihood (0-1)': 0.6,
            'Harm Mean (0-1)': 0.85, 'Harm Variance': 0.008,
            'Is New Threat? (yes/no)': 'no', 'Source / Justification (optional)': 'Internal pen-test 2025'
        }])
        example.to_excel(writer, sheet_name='Example (delete me)', index=False)
    buf.seek(0)
    return send_file(buf, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     as_attachment=True, download_name='risk_data_template.xlsx')

def _yn(val):
    return str(val).strip().lower() in ('yes', 'y', 'true', '1')

@app.route('/api/upload', methods=['POST'])
def upload_excel():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400
    try:
        xls = pd.ExcelFile(file)
        threats, mitigations, mapping = [], [], []

        if 'Threats' in xls.sheet_names:
            df = xls.parse('Threats')
            df = df.dropna(subset=[df.columns[0]])
            for _, row in df.iterrows():
                try:
                    threats.append({
                        'id': str(row.get('ID', '')).strip(),
                        'label': str(row.get('Label', '') or ''),
                        'likelihood': float(row.get('Likelihood (0-1)')),
                        'harm_mean': float(row.get('Harm Mean (0-1)')),
                        'harm_variance': float(row.get('Harm Variance')),
                        'is_new': _yn(row.get('Is New Threat? (yes/no)', 'no')),
                    })
                except (ValueError, TypeError):
                    continue

        if 'Controls' in xls.sheet_names:
            df = xls.parse('Controls')
            df = df.dropna(subset=[df.columns[0]])
            for _, row in df.iterrows():
                try:
                    mitigations.append({
                        'id': str(row.get('ID', '')).strip(),
                        'label': str(row.get('Label', '') or ''),
                        'cost_min': float(row.get('Cost Min ($)')),
                        'cost_max': float(row.get('Cost Max ($)')),
                        'eff_mean': float(row.get('Effectiveness Mean (0-1)')),
                        'eff_variance': float(row.get('Effectiveness Variance')),
                        'already_implemented': _yn(row.get('Already Implemented? (yes/no)', 'no')),
                    })
                except (ValueError, TypeError):
                    continue

        if 'Mapping' in xls.sheet_names:
            df = xls.parse('Mapping')
            df = df.dropna(subset=[df.columns[0]])
            for _, row in df.iterrows():
                t = str(row.get('Threat ID', '')).strip()
                m = str(row.get('Control ID', '')).strip()
                if t and m:
                    mapping.append({'threat': t, 'mitigation': m})

        return jsonify({'threats': threats, 'mitigations': mitigations, 'mapping': mapping})
    except Exception as e:
        return jsonify({'error': f'Could not read file: {str(e)}'}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
