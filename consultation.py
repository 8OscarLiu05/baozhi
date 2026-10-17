"""REQ057: deterministic synthetic needs scenarios; not policy wording or underwriting."""
import itertools
import json

import intl

VERSION = 'SYN-1'
AGES = ('18–29岁', '30–39岁', '40–49岁', '50–59岁', '60岁及以上')
GENDERS = ('男', '女')
HEALTH = ('未说明疾病', '高血压', '糖尿病', '既往住院', '其他情况')
TOPICS = {
    '家庭责任': '先列出需要照顾的家庭成员、负债和已有保障，再核对寿险责任与期限。',
    '医疗支出': '先区分医疗费用与生活支出，再核对已有医保、医疗险的责任、免赔额和限制。',
    '重大疾病': '先核对疾病定义、等待期和给付条件，不能把诊断名称直接等同于合同约定。',
    '意外风险': '先核对职业、事故经过与意外定义，疾病导致的事件不能直接当作意外。',
    '养老安排': '先确认领取需求和缴费负担，再核对年金开始时间、领取条件和退保影响。',
    '条款阅读': '把产品名称、版本、责任、除外、等待期及申请材料分开核对。',
}
PAY = ('尚未确定', '一次交清', '分期缴费')
AGE_NOTES = {
    '18–29岁': '补充信息：职业、收入稳定性、已有保障和家庭责任。',
    '30–39岁': '补充信息：家庭支出、负债、需要照顾的成员和已有保障。',
    '40–49岁': '补充信息：家庭责任的持续时间、健康情况和长期缴费负担。',
    '50–59岁': '补充信息：退休安排、已有保障到期时间和可持续缴费预算。',
    '60岁及以上': '补充信息：已有医疗保障、养老现金流及拟咨询产品的年龄限制。',
}
HEALTH_NOTES = {
    '未说明疾病': '健康资料尚未说明，不能视作没有既往疾病。',
    '高血压': '需进一步核对健康告知对高血压及相关情况的提问，不能仅凭病名判断承保。',
    '糖尿病': '需进一步核对健康告知对糖尿病、治疗及相关情况的提问，不能仅凭病名判断承保。',
    '既往住院': '需补充住院原因及时间，再核对健康告知和既往症相关约定。',
    '其他情况': '需具体说明相关情况，再逐项核对健康告知；不能用“其他”代替正式告知。',
}
REFUSAL = '此问题不属于保险业务咨询范畴，或无该信息权限。请改问已授权资料中的具体问题。'
REFUSAL_EN = ('This question is outside insurance consultation, or you are not authorized to see that information. '
              'Please ask a specific question about the authorized material.')

TOPICS_EN = {
    '家庭责任': ('family responsibilities', 'First list the family members you support, any debts and the cover you already have; then check the life cover benefits and term.'),
    '医疗支出': ('medical costs', 'First separate medical bills from living costs; then check the benefits, deductibles and limits of your public medical insurance and any medical policy.'),
    '重大疾病': ('critical illness', 'First check the illness definitions, waiting period and payment conditions; a diagnosis name is not the same as what the contract defines.'),
    '意外风险': ('accident risk', 'First check the occupation, what happened and the definition of accident; an event caused by illness is not automatically an accident.'),
    '养老安排': ('retirement planning', 'First confirm the income you need and the premiums you can afford; then check when annuity payments start, the conditions and the effect of surrender.'),
    '条款阅读': ('reading a clause', 'Check the product name, version, benefits, exclusions, waiting period and claim documents one by one.'),
}
AGES_EN = {'18–29岁': 'Age 18-29', '30–39岁': 'Age 30-39', '40–49岁': 'Age 40-49', '50–59岁': 'Age 50-59', '60岁及以上': 'Age 60+'}
AGE_NOTES_EN = {
    '18–29岁': 'Also tell us: occupation, how stable your income is, existing cover and family responsibilities.',
    '30–39岁': 'Also tell us: household spending, debts, the people you support and existing cover.',
    '40–49岁': 'Also tell us: how long family responsibilities will last, your health and the long-term premium burden.',
    '50–59岁': 'Also tell us: retirement plans, when existing cover ends and a premium budget you can sustain.',
    '60岁及以上': 'Also tell us: existing medical cover, retirement cash flow and the age limits of the product you are asking about.',
}
GENDERS_EN = {'男': 'male', '女': 'female'}
HEALTH_EN = {'未说明疾病': 'no condition stated', '高血压': 'hypertension', '糖尿病': 'diabetes', '既往住院': 'previous hospital stay', '其他情况': 'other condition'}
HEALTH_NOTES_EN = {
    '未说明疾病': 'Health information has not been given yet; this does not mean there is no pre-existing condition.',
    '高血压': 'Check how the health disclosure asks about hypertension and related conditions; approval cannot be judged from the diagnosis alone.',
    '糖尿病': 'Check how the health disclosure asks about diabetes, its treatment and related conditions; approval cannot be judged from the diagnosis alone.',
    '既往住院': 'Give the reason and date of the hospital stay, then check the health disclosure and the pre-existing condition terms.',
    '其他情况': 'Describe the condition, then go through the health disclosure item by item; "other" cannot replace a formal disclosure.',
}
PAY_EN = {'尚未确定': 'not decided', '一次交清': 'single payment', '分期缴费': 'regular payments'}


def refusal():
    return intl.pick(REFUSAL, REFUSAL_EN)


def answer_en(row, profile):
    lines = [TOPICS_EN[row['topic']][1], AGE_NOTES_EN[row['age']], HEALTH_NOTES_EN[row['health']],
             'Health information must be disclosed truthfully; with a pre-existing condition, check the health disclosure and related limits. This page does not decide whether you can be insured.',
             f"Payment preference: {PAY_EN[profile['pay']]}. This is only a preference; it does not mean any product offers that payment option."]
    return '\n'.join(lines)

def rows():
    for index, (topic, age, gender, health) in enumerate(itertools.product(TOPICS, AGES, GENDERS, HEALTH), 1):
        yield {'id': f'SYN-{index:03d}', 'version': VERSION, 'topic': topic, 'age': age,
               'gender': gender, 'health': health, 'answer': '\n'.join((TOPICS[topic], AGE_NOTES[age], HEALTH_NOTES[health])),
               'source_type': '项目自编合成情景', 'roles': ['sales', 'customer'],
               'note': '仅用于需求梳理与软件测试，不是保险条款、承保规则或独立验证样本。'}

def initialize(c):
    c.execute('CREATE TABLE IF NOT EXISTS consultation_scenarios(id TEXT, version TEXT, payload TEXT, PRIMARY KEY(id,version))')
    c.executemany('INSERT OR IGNORE INTO consultation_scenarios VALUES(?,?,?)',
                  [(r['id'], VERSION, json.dumps(r, ensure_ascii=False)) for r in rows()])

def catalog():
    return {'ages': AGES, 'genders': GENDERS, 'health': HEALTH, 'topics': list(TOPICS), 'pay': PAY}

def board(c):
    items = [json.loads(r[0]) for r in c.execute('SELECT payload FROM consultation_scenarios WHERE version=? ORDER BY id', (VERSION,))]
    return {'version': VERSION, 'count': len(items), 'templates': len(TOPICS), 'items': items,
            'notice': '300个组合情景来自6个自编模板。不是300份条款，也不是300个独立实证样本。'}

def lookup(c, profile, role):
    if not isinstance(profile, dict):
        raise ValueError('请选择咨询情景')
    for key, options in [('topic', TOPICS), ('age', AGES), ('gender', GENDERS), ('health', HEALTH), ('pay', PAY)]:
        if profile.get(key) not in options:
            raise ValueError('咨询选项无效，请重新选择：' + key)
    for raw in c.execute('SELECT payload FROM consultation_scenarios WHERE version=?', (VERSION,)):
        row = json.loads(raw[0])
        if role in row['roles'] and all(row[k] == profile[k] for k in ('topic', 'age', 'gender', 'health')):
            if intl.english():
                return row, answer_en(row, profile)
            answer = row['answer']
            answer += '\n健康情况需如实说明；有既往疾病时，应核对健康告知和相关限制。本页不判断能否投保。'
            answer += '\n缴费偏好：' + profile['pay'] + '。这只是需求，不表示某个产品支持该缴费方式。'
            return row, answer
    return None, refusal()

def question(profile):
    if intl.english():
        return (f"{AGES_EN.get(profile['age'], profile['age'])}, {GENDERS_EN.get(profile['gender'], profile['gender'])}, health: "
                f"{HEALTH_EN.get(profile['health'], profile['health'])}, payment preference: {PAY_EN.get(profile['pay'], profile['pay'])}. "
                f"I want to understand {TOPICS_EN.get(profile['topic'], (profile['topic'],))[0]}. What should I check first?")
    return f"{profile['age']}，{profile['gender']}，健康情况：{profile['health']}，缴费偏好：{profile['pay']}。想了解{profile['topic']}，应该先核对什么？"

def turn(reply, status='local', evidence=None, consultation=None, model=None):
    model = model or {'status': status}
    adopted = model.get('status') == 'ok'
    return {'reply': reply, 'evidence': evidence or [], 'model': model, 'flags': [], 'rules': [],
            'adopted': adopted, 'manual': not adopted, 'trace': {
                'consultation': consultation or {}, 'matched_fact': [], 'model_output': model.get('text', ''),
                'number_check': {'checked': False, 'ok': None, 'detail': intl.pick('通用咨询或需求梳理不作合同数字核验', 'General questions and needs exploration are not checked against contract figures')},
                'version_label': VERSION, 'final_answer': reply}}
