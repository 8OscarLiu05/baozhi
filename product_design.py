"""Versioned research assumptions and a deliberately conditional benefit simulator."""
import json
import math
from datetime import date, datetime, timezone

PARAMETERS = {
    'daily': ('每日津贴（元）', 1, 1000),
    'waiting': ('等待期（天）', 0, 180),
    'deductible': ('每次免给付天数', 0, 30),
    'per_stay': ('单次给付天数上限', 1, 180),
    'annual': ('年度累计给付天数上限', 1, 365),
}
DEFAULT = {
    'name': '骑安心 · 慢病骑手住院津贴研究方案',
    'parameters': {'daily': 100, 'waiting': 30, 'deductible': 3, 'per_stay': 30, 'annual': 60},
    'notes': '拟先研究一个城市的成年外卖骑手，重点讨论高血压相关因病住院责任。城市、年龄范围、健康告知、医院范围及疾病纳入条件尚待确定。参数仅用于比较设计，不是推荐条款或报价。',
}
BOUNDARIES = [
    {'title': '拟解决什么', 'text': '符合约定的因病住院发生后，提供定额津贴，缓解住院期间生活支出压力。是否确有未满足需求，需要访谈和条款比较。'},
    {'title': '拟覆盖什么', 'text': '研究按日额和可给付天数计算的住院津贴；优先论证有条件纳入高血压相关住院。允许申请投保、属于责任范围和最终赔付必须分别核对。'},
    {'title': '首期不设计什么', 'text': '不报销医疗费用，不按实际少赚的收入补偿，不覆盖门诊或出院后停工；交通意外先在已有保障地图中核对，不自动纳入本产品。'},
    {'title': '必须交专业人员决定', 'text': '疾病纳入与除外、告知与核保、医院及必要住院定义、续保、同次住院合并规则、数据授权、条款费率和承保可行性。'},
]
GATES = [
    {'owner': '用户研究', 'question': '骑手真正缺的是哪类支出保障？', 'evidence': '建议访谈8—12名骑手，区分医疗支出、日常生活和出院后停工；记录已有保障和付费意愿。便利样本不代表全体。'},
    {'owner': '保险专业', 'question': '现有产品已经解决了多少？', 'evidence': '至少比较3份完整条款的投保、既往症、津贴、等待期、限额及续保；由保险成员记录出处，老师复核。'},
    {'owner': '精算与核保', 'question': '高血压相关责任能否承保和定价？', 'evidence': '需要可解释的住院频率、天数、疾病分层与费用数据；评估逆选择和重复住院。现阶段无真实定价结论。'},
    {'owner': '技术与体验', 'question': '中台是否减少误解和维护工作？', 'evidence': '独立案例核对限制漏检、错误赔付承诺、引用定位；用两份资料验证复用；比较阅读原文和使用系统后的理解程度。'},
]


def dumps(value):
    return json.dumps(value, ensure_ascii=False)


def initialize(c):
    c.execute('CREATE TABLE IF NOT EXISTS product_designs(version INTEGER PRIMARY KEY, created TEXT, data TEXT)')
    c.execute('CREATE TABLE IF NOT EXISTS benefit_simulations(id INTEGER PRIMARY KEY, created TEXT, data TEXT)')
    if not c.execute('SELECT 1 FROM product_designs LIMIT 1').fetchone():
        c.execute('INSERT INTO product_designs VALUES(1,?,?)', (datetime.now(timezone.utc).isoformat(), dumps(DEFAULT)))


def current(c):
    row = c.execute('SELECT * FROM product_designs ORDER BY version DESC LIMIT 1').fetchone()
    return {**json.loads(row['data']), 'version': row['version'], 'created': row['created']}


def state(c):
    return {'current': current(c), 'boundaries': BOUNDARIES, 'gates': GATES,
            'parameter_labels': {k: v[0] for k, v in PARAMETERS.items()},
            'history': [{'version': r['version'], 'created': r['created']} for r in c.execute('SELECT version,created FROM product_designs ORDER BY version DESC')]}


def integer(value, label, lo, hi):
    if isinstance(value, bool):
        raise ValueError(label + '必须是整数')
    try:
        number = float(value)
    except (ValueError, TypeError):
        raise ValueError(label + '必须是整数')
    if not math.isfinite(number) or not number.is_integer() or not lo <= number <= hi:
        raise ValueError(f'{label}须为{lo}至{hi}之间的整数')
    return int(number)


def save(c, data):
    c.execute('BEGIN IMMEDIATE')
    old = current(c)
    if data.get('version') != old['version']:
        raise ValueError('方案版本已变化，请刷新后重新编辑')
    raw = data.get('parameters')
    if not isinstance(raw, dict):
        raise ValueError('请完整填写参数')
    values = {k: integer(raw.get(k), label, lo, hi) for k, (label, lo, hi) in PARAMETERS.items()}
    if values['annual'] < values['per_stay']:
        raise ValueError('年度上限不能小于单次上限')
    notes = data.get('notes')
    if not isinstance(notes, str) or not 1 <= len(notes.strip()) <= 2000:
        raise ValueError('研究备注须为1至2000字')
    new = {'name': old['name'], 'parameters': values, 'notes': notes.strip()}
    c.execute('INSERT INTO product_designs VALUES(?,?,?)', (old['version'] + 1, datetime.now(timezone.utc).isoformat(), dumps(new)))
    return current(c)


def simulate(design, data):
    p = design['parameters']
    dates = {}
    for key, label in [('start', '假设保障起始日'), ('end', '假设保障终止日'), ('admission', '入院日'), ('discharge', '出院日')]:
        try:
            dates[key] = date.fromisoformat(data[key])
        except (KeyError, ValueError, TypeError):
            raise ValueError(label + '格式不正确')
    if dates['end'] < dates['start'] or (dates['end'] - dates['start']).days > 366:
        raise ValueError('假设保险期间须为不超过367个自然日的有效区间')
    stay = (dates['discharge'] - dates['admission']).days
    if not 0 <= stay <= 365:
        raise ValueError('出院日不能早于入院日，住院区间最多365天')
    used = integer(data.get('used'), '年度已给付天数', 0, p['annual'])
    eligibility = data.get('eligibility')
    if eligibility not in ('unknown', 'assumed_yes', 'assumed_no'):
        raise ValueError('请选择责任条件状态')
    result = {'design_version': design['version'], 'parameters': dict(p), 'inputs': {**{k: str(v) for k, v in dates.items()}, 'used': used, 'eligibility': eligibility},
              'status': 'pending', 'amount': None, 'payable_days': None,
              'notice': '仅虚拟设计情景测算，不核保、不审核医学必要性、不构成赔付结论。参数未经精算或保险专业审定。',
              'convention': '本演示按出院日减入院日计天数；等待期按入院日与起保日之差计算，满设定天数才进入公式；整次住院须在假设保险期间内。跨期、同次住院合并及续保需人工另行核对。'}
    if eligibility == 'unknown':
        result['reason'] = '责任、疾病限制或医院条件尚未确认，暂不计算金额。先核对完整条款及个人保障信息。'
        return result
    if eligibility == 'assumed_no':
        result.update(status='excluded', amount=0, payable_days=0, reason='该虚拟情景设定为不满足责任条件；不代表真实拒赔。')
        return result
    if dates['admission'] < dates['start'] or dates['discharge'] > dates['end']:
        result['reason'] = '住院区间超出假设保险期间，本演示不能判断跨期责任，转人工核对。'
        return result
    if (dates['admission'] - dates['start']).days < p['waiting']:
        result.update(status='waiting', amount=0, payable_days=0, reason='按本演示的等待期计算约定，入院时尚未满等待期。')
        return result
    remaining = p['annual'] - used
    payable = min(max(0, stay - p['deductible']), p['per_stay'], remaining)
    result.update(status='calculated', amount=payable * p['daily'], payable_days=payable,
                  reason=f'假设责任条件满足：min(max({stay}−{p["deductible"]}, 0), {p["per_stay"]}, {remaining}) × {p["daily"]} = {payable * p["daily"]}元。',
                  hospital_days=stay, annual_remaining=remaining)
    return result


def document_text(design):
    parts = [f'【研究草案 v{design["version"]}】{design["name"]}。不是在售保险，不是已审定条款。']
    parts += [f'【{b["title"]}】{b["text"]}' for b in BOUNDARIES]
    parts += ['【参数假设】' + '；'.join(f'{PARAMETERS[k][0]}：{v}' for k, v in design['parameters'].items()) + '。仅供设计比较，非推荐保障或正式费率。',
              '【演示计算口径】出院日减入院日；入院日距起保日满等待天数；减免给付天数后，同时受单次及年度剩余天数约束。跨期和同次住院合并另核。',
              '【研究备注】' + design['notes'],
              '【模拟申请准备】讨论需要确认住院事实、出入院日期、医院与疾病责任、个人保障状态及本年度已给付天数。真实申请以正式条款和渠道为准。']
    return '\n\n'.join(parts)
