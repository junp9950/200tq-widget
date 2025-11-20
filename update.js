const fs = require('fs');

async function main() {
    try {
        const TICKER = "TQQQ";
        const COLORS = {
            price: "#58ccff",   // 하늘색 (현재가)
            env: "#b96bc6",     // 보라색 (Envelope)
            ma200: "#AFD485",   // 연두색 (200일선)
            buy: "#fd8a69",     // 주황색 (매수)
            sell: "#58ccff",    // 하늘색 (매도)
            maintain: "#b96bc6",// 보라색 (유지)
            text: "#ffffff",    // 흰색
            gray: "#aaaaaa"     // 회색
        };

        // 1. 데이터 조회
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?range=300d&interval=1d`);
        const data = await res.json();
        const result = data.chart.result[0];
        
        const closes = result.indicators.quote[0].close;
        closes[closes.length - 1] = result.meta.regularMarketPrice;

        // 2. MA200 계산
        const ma200 = [];
        let sum = 0;
        for (let i = 0; i < closes.length; i++) {
            sum += closes[i];
            if (i >= 200) sum -= closes[i - 200];
            if (i >= 199) ma200.push(sum / 200); else ma200.push(null);
        }

        const currentPrice = closes[closes.length - 1];
        const currentMA200 = ma200[ma200.length - 1];
        const prevPrice = closes[closes.length - 2];
        const prevMA200 = ma200[ma200.length - 2];
        const envelope = currentMA200 * 1.05;

        // 3. 상황 판단 및 BBCode 색상 입히기
        let statusRaw = ""; 
        let actionRich = ""; // BBCode 적용된 텍스트

        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            statusRaw = "상승 신호!";
            actionRich = `내일 종가 확인 후 [c=${COLORS.buy}]진입[/c]`;
        } else if (currentPrice > envelope) {
            statusRaw = "과열 상황";
            actionRich = `TQQQ [c=${COLORS.maintain}]유지[/c] / SPYM [c=${COLORS.buy}]추가매수[/c]`;
        } else if (currentPrice > currentMA200) {
            statusRaw = "집중 투자 상황";
            actionRich = `SGOV [c=${COLORS.sell}]매도[/c] / TQQQ [c=${COLORS.buy}]매수[/c]`;
        } else {
            statusRaw = "하락 상황";
            actionRich = `SPYM TQQQ [c=${COLORS.sell}]매도[/c] / SGOV [c=${COLORS.buy}]매수[/c]`;
        }

        // 4. 디테일 데이터 생성
        // (1) 날짜: "25. 11. 20. 종가 기준"
        const today = new Date();
        const dateStr = `${today.getFullYear().toString().slice(2)}. ${today.getMonth()+1}. ${today.getDate()}. 종가 기준`;

        // (2) 수익률/편차
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationStr = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;
        const statusRich = `${statusRaw} [c=${COLORS.gray}]${deviationStr}[/c]`;

        // (3) 3색 가격표: "$100.05 / $86.08 / $81.98" (각각 색상 적용)
        const pricesRich = `[c=${COLORS.price}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.env}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;

        // 5. 차트 생성
        const sliceCnt = 90;
        const chartData = {
            type: 'line',
            data: {
                labels: new Array(sliceCnt).fill(''),
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.price, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v*1.05).toFixed(2))), borderColor: COLORS.env, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { legend: { display: false }, scales: { x: { display: false }, y: { display: false } } }
        };
        const chartUrl = `https://quickchart.io/chart?w=600&h=350&bkg=black&c=${encodeURIComponent(JSON.stringify(chartData))}`;

        // 6. 결과 저장
        const output = {
            title: "TQQQ SMA 200days",
            date: dateStr,
            status: statusRich,   // BBCode 포함
            action: actionRich,   // BBCode 포함
            prices: pricesRich,   // BBCode 포함
            chartUrl: chartUrl,
            updated: new Date().toISOString()
        };
        
        fs.writeFileSync('result.json', JSON.stringify(output));
        console.log("Full Option Data Generated.");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();