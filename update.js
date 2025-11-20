// 파일명: update.js
const fs = require('fs');

async function main() {
    try {
        const TICKER = "TQQQ";
        // 1. 데이터 조회 (300일치)
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?range=300d&interval=1d`);
        const data = await res.json();
        const result = data.chart.result[0];
        
        const closes = result.indicators.quote[0].close;
        // 장중이라면 현재가로 마지막 데이터 덮어쓰기
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
        const envelope = currentMA200 * 1.05; // 5% 엔벨로프

        // 3. 상황 판단 로직
        let status = "보합/관망";
        let action = "HOLD";
        let color = "#FFFFFF";

        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            status = "골든크로스 (상승신호)"; action = "진입 대기"; color = "#fd8a69";
        } else if (currentPrice > envelope) {
            status = "과열 구간"; action = "분할 매도 / SPYM"; color = "#b96bc6";
        } else if (currentPrice > currentMA200) {
            status = "상승 추세"; action = "TQQQ 매수/보유"; color = "#fd8a69";
        } else {
            status = "하락 추세"; action = "현금 확보 / SGOV"; color = "#58ccff";
        }

        // 4. 차트 URL 생성 (QuickChart API)
        // 쿼리 길이 최적화를 위해 최근 90일치만 사용 + 소수점 2자리 절삭
        const sliceCnt = 90;
        const chartData = {
            type: 'line',
            data: {
                labels: new Array(sliceCnt).fill(''),
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: '#58ccff', borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: '#AFD485', borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v*1.05).toFixed(2))), borderColor: '#b96bc6', borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { legend: { display: false }, scales: { x: { display: false }, y: { display: false } } }
        };
        const chartUrl = `https://quickchart.io/chart?w=600&h=350&bkg=black&c=${encodeURIComponent(JSON.stringify(chartData))}`;

        // 5. JSON 저장
        const output = {
            price: currentPrice.toFixed(2),
            ma200: currentMA200.toFixed(2),
            status: status,
            action: action,
            color: color,
            chartUrl: chartUrl,
            updated: new Date().toISOString()
        };
        
        fs.writeFileSync('result.json', JSON.stringify(output));
        console.log("Done.");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();