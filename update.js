const fs = require('fs');

async function main() {
    try {
        const TICKER = "TQQQ";
        // 1. 데이터 조회
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?range=300d&interval=1d`);
        const data = await res.json();
        const result = data.chart.result[0];
        
        // 액면분할 대응 (수정주가 사용)
        let closes = [];
        if (result.indicators.adjclose && result.indicators.adjclose[0].adjclose) {
            closes = result.indicators.adjclose[0].adjclose;
        } else {
            closes = result.indicators.quote[0].close;
        }
        closes = closes.map(p => p === null ? 0 : p);
        
        // 현재가 업데이트
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
        
        // [설정] 10% 엔벨로프 (앱과 동일하게 맞춤)
        const envelope = currentMA200 * 1.10; 

        // 3. 상황 판단 로직 (줄바꿈 \n 완벽 복구)
        const COLORS = {
            price: "#58ccff", env: "#b96bc6", ma200: "#AFD485",
            buy: "#fd8a69", sell: "#58ccff", maintain: "#b96bc6", gray: "#aaaaaa"
        };

        let statusRaw = ""; 
        let actionRich = "";

        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            statusRaw = "상승 신호!";
            actionRich = `내일 종가 확인 후\n[c=${COLORS.buy}]진입[/c]`;
        } else if (currentPrice > envelope) {
            statusRaw = "과열 상황";
            actionRich = `TQQQ [c=${COLORS.maintain}]유지[/c]\nSPYM [c=${COLORS.buy}]추가매수[/c]`;
        } else if (currentPrice > currentMA200) {
            statusRaw = "집중 투자";
            actionRich = `SGOV [c=${COLORS.sell}]매도[/c]\nTQQQ [c=${COLORS.buy}]매수[/c]`;
        } else {
            statusRaw = "하락 상황";
            // 여기가 중요: 두 줄로 줄바꿈
            actionRich = `SPYM TQQQ [c=${COLORS.sell}]매도[/c]\nSGOV [c=${COLORS.buy}]매수[/c]`;
        }

        // 편차 및 가격표
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationStr = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;
        const statusRich = `${statusRaw} [c=${COLORS.gray}]${deviationStr}[/c]`;
        const pricesRich = `[c=${COLORS.price}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.env}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;

        // 날짜
        const today = new Date();
        const dateStr = `${today.getFullYear().toString().slice(2)}. ${today.getMonth()+1}. ${today.getDate()}. 종가 기준`;

        // 4. 차트 생성 (깔끔하게 축 숨김)
        const sliceCnt = 90;
        const chartData = {
            type: 'line',
            data: {
                labels: new Array(sliceCnt).fill(''),
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.price, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v*1.10).toFixed(2))), borderColor: COLORS.env, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { 
                legend: { display: false }, 
                scales: { yAxes: [{ display: false }], xAxes: [{ display: false }] },
                layout: { padding: 10 }
            }
        };
        const chartUrl = `https://quickchart.io/chart?w=600&h=350&bkg=black&c=${encodeURIComponent(JSON.stringify(chartData))}`;

        // 5. 결과 저장
        const output = {
            title: "TQQQ SMA 200days",
            date: dateStr,
            status: statusRich,
            action: actionRich,
            prices: pricesRich,
            chartUrl: chartUrl,
            updated: new Date().toISOString()
        };
        
        fs.writeFileSync('result.json', JSON.stringify(output));
        console.log("Done. (Newlines Restored)");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();