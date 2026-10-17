"""Synthetic teaching curves, unrelated to any insurer or pricing table."""
def calculate(age=30, pay=5, annual=10000):
    age, pay, annual = int(age), int(pay), int(annual)
    if not 18 <= age <= 65 or pay not in (3, 5, 10) or not 1000 <= annual <= 100000:
        raise ValueError('年龄18—65岁，投入期3/5/10年，每年假设投入1000—100000元。')
    rows = []
    for year in range(1, 31):
        paid = annual * min(year, pay)
        cash = round(paid * min(.5 + .025 * year, 1.1))
        rows.append(dict(year=year, age=age+year, premium=paid, cash=cash, death=max(paid, cash), contribution=annual if year <= pay else 0))
    return dict(age=age, pay=pay, annual=annual, chart=rows, fictional=True,
                notice='全部数字由本项目自编，只用于讲解投入与退出的区别，不对应真实保险、报价或赔付。',
                formula='累计投入=每年投入×已投入年数；退出金额示例=累计投入×min(0.5+0.025×年度,1.1)；责任金额示例=max(累计投入,退出金额示例)。这些系数是教学设定，没有精算依据。年龄只改变时间轴上的年龄，不参与计算。')
