const fs = require('fs');

async function main() {
    try {
        const TICKER = "TQQQ";

        // 1. 데이터 조회
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?range=300d&interval=1d`);
        const data = await res.json();
        const result = data.chart.result[0];

        // 수정주가 사용
        let closes = [];
        if (result.indicators.adjclose && result.indicators.adjclose[0].adjclose) {
            closes = result.indicators.adjclose[0].adjclose;
        } else {
            closes = result.indicators.quote[0].close;
        }
        closes = closes.map(v => v ?? 0);

        // 현재가 반영
        closes[closes.length - 1] = result.meta.regularMarketPrice;

        // 2. MA200 계산
        const ma200 = [];
        let sum = 0;
        for (let i = 0; i < closes.length; i++) {
            sum += closes[i];
            if (i >= 200) sum -= closes[i - 200];
            ma200.push(i >= 199 ? sum / 200 : null);
        }

        const currentPrice = closes.at(-1);
        const prevPrice = closes.at(-2);
        const currentMA200 = ma200.at(-1);

        // Envelope (+10%)
        const envelope = currentMA200 * 1.10;

        // 3. 판단 로직
        const COLORS = {
            price: "#58ccff",
            env: "#b96bc6",
            ma200: "#AFD485",
            buy: "#fd8a69",
            sell: "#58ccff",
            maintain: "#b96bc6",
            gray: "#aaaaaa"
        };

        let statusRaw = "";
        let actionRich = "";

        // 하락
        if (currentPrice <= currentMA200) {
            statusRaw = "하락 상황";
            actionRich = `SPYM TQQQ [c=${COLORS.sell}]매도[/c]\nSGOV [c=${COLORS.buy}]매수[/c]`;
        }
        // 과열
        else if (currentPrice > envelope) {
            statusRaw = "과열 상황";
            actionRich = `TQQQ [c=${COLORS.maintain}]유지[/c]\nSPYM [c=${COLORS.buy}]추가매수[/c]`;
        }
        // 노란~보라 사이
        else {
            // 하루 상승 → 진입 대기
            if (currentPrice > prevPrice) {
                statusRaw = "진입 대기";
                actionRich = `내일 종가 확인 후\n[c=${COLORS.buy}]진입[/c]`;
            }
            // 미상승 → 대기
            else {
                statusRaw = "집중 투자";
                actionRich = `대기 (상승 확인 필요)`;
            }
        }

        // 편차
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationStr = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

        const statusRich = `${statusRaw} [c=${COLORS.gray}]${deviationStr}[/c]`;
        const pricesRich =
            `[c=${COLORS.price}]$${currentPrice.toFixed(2)}[/c] / ` +
            `[c=${COLORS.env}]$${envelope.toFixed(2)}[/c] / ` +
            `[c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;

        // 날짜
        const today = new Date();
        const dateStr = `${today.getFullYear().toString().slice(2)}. ${today.getMonth() + 1}. ${today.getDate()}. 종가 기준`;

        // 4. 차트
        const sliceCnt = 90;
        const chartData = {
            type: 'line',
            data: {
                labels: new Array(sliceCnt).fill(''),
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v => +v.toFixed(2)), borderColor: COLORS.price, borderWidth: 2, pointRadius: 0 },
                    { data: ma200.slice(-sliceCnt).map(v => v ? +v.toFixed(2) : null), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0 },
                    { data: ma200.slice(-sliceCnt).map(v => v ? +(v * 1.10).toFixed(2) : null), borderColor: COLORS.env, borderWidth: 1, borderDash: [5, 5], pointRadius: 0 }
                ]
            },
            options: {
                legend: { display: false },
                scales: { yAxes: [{ display: false }], xAxes: [{ display: false }] },
                layout: { padding: 10 }
            }
        };

        const chartUrl = `https://quickchart.io/chart?w=600&h=350&bkg=black&c=${encodeURIComponent(JSON.stringify(chartData))}`;

        // 5. 저장
        const output = {
            title: "TQQQ SMA 200days",
            date: dateStr,
            status: statusRich,
            action: actionRich,
            prices: pricesRich,
            chartUrl,
            updated: new Date().toISOString()
        };

        fs.writeFileSync('result.json', JSON.stringify(output));
        console.log("Done");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
