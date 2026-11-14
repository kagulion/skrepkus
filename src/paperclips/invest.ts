import { ClipsState, Stock, displayMessage } from './state';
import { formatWithCommas } from './format';

const RISKINESS: Record<ClipsState['investStrat'], number> = { low: 7, med: 5, hi: 1 };

export function investDeposit(s: ClipsState): void {
  s.ledger -= Math.floor(s.funds);
  s.bankroll = Math.floor(s.bankroll + s.funds);
  s.funds = 0;
}

export function investWithdraw(s: ClipsState): void {
  s.ledger += s.bankroll;
  s.funds += s.bankroll;
  s.bankroll = 0;
}

export function investUpgrade(s: ClipsState): void {
  if (s.yomi < s.investUpgradeCost) return;
  s.yomi -= s.investUpgradeCost;
  s.investLevel++;
  s.stockGainThreshold += 0.01;
  s.investUpgradeCost = Math.floor((s.investLevel + 1) ** Math.E * 100);
  displayMessage(
    s,
    'Инвестиционный модуль улучшен, ожидаемое соотношение прибыли и убытка теперь ' +
      String(s.stockGainThreshold).replace('.', ','),
  );
}

function generateSymbol(): string {
  const x = Math.random();
  const letters = x <= 0.01 ? 1 : x <= 0.1 ? 2 : x <= 0.4 ? 3 : 4;
  let name = '';
  for (let i = 0; i < letters; i++) name += String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return name;
}

function createStock(s: ClipsState, dollars: number): void {
  s.stockID++;
  const symbol = generateSymbol();
  const roll = Math.random();
  const top = roll > 0.99 ? 3000 : roll > 0.85 ? 500 : roll > 0.6 ? 150 : roll > 0.2 ? 50 : 15;
  let price = Math.ceil(Math.random() * top);
  if (price > dollars) price = Math.ceil(dollars * roll);
  const amount = Math.min(Math.floor(dollars / price), 1_000_000);
  const stock: Stock = { id: s.stockID, symbol, price, amount, total: price * amount, profit: 0, age: 0 };
  s.stocks.push(stock);
  s.bankroll -= price * amount;
}

/** Раз в секунду: с вероятностью 25% покупает новую бумагу на часть портфеля. */
export function stockShop(s: ClipsState): void {
  const r = s.riskiness;
  let budget = Math.ceil(s.portTotal / r);
  const reserves = r === 1 ? 0 : Math.ceil(s.portTotal / (11 - r));
  if (s.bankroll - budget < reserves) {
    if (r === 1) budget = s.bankroll > s.portTotal / 10 ? s.bankroll : 0;
    else budget = s.bankroll - reserves;
  }
  if (
    s.stocks.length < s.maxPort &&
    s.bankroll >= 5 &&
    budget >= 1 &&
    s.bankroll - budget >= reserves &&
    Math.random() < 0.25
  ) {
    createStock(s, budget);
  }
}

function updateStocks(s: ClipsState): void {
  for (const st of s.stocks) {
    st.age++;
    if (Math.random() >= 0.6) continue;
    const gain = Math.random() <= s.stockGainThreshold;
    const delta = Math.ceil((Math.random() * st.price) / (4 * s.riskiness));
    st.price += gain ? delta : -delta;
    if (st.price === 0 && Math.random() > 0.24) st.price = 1;
    st.total = st.price * st.amount;
    st.profit += (gain ? delta : -delta) * st.amount;
  }
}

/** Раз в 2,5 с: продаёт самую старую бумагу (не чаще раза в 12,5 с) и двигает цены. */
export function stockMarket(s: ClipsState): void {
  s.sellDelay++;
  if (s.stocks.length > 0 && s.sellDelay >= 5 && Math.random() <= 0.3) {
    s.bankroll += s.stocks[0].total;
    s.stocks.splice(0, 1);
    s.sellDelay = 0;
  }
  if (s.stocks.length > 0) updateStocks(s);
}

/** Раз в 100 мс: риск из настроек и стоимость портфеля. */
export function updatePortfolio(s: ClipsState): void {
  s.riskiness = RISKINESS[s.investStrat];
  s.secTotal = s.stocks.reduce((sum, st) => sum + st.total, 0);
  s.portTotal = s.bankroll + s.secTotal;
}

export function stockReport(s: ClipsState): void {
  if (!s.investmentEngineFlag) return;
  s.stockReportCounter++;
  if (s.stockReportCounter >= 10_000) {
    displayMessage(s, `Отчёт о доходе от инвестиций за всё время: ${formatWithCommas(s.ledger + s.portTotal)} ₽`);
    s.stockReportCounter = 0;
  }
}
