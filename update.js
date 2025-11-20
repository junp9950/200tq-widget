const fs = require('fs');

async function main() {
    try {
        const TICKER = "TQQQ";
        // 1. 데이터 조회
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${TICKER}?range=300d&interval=1d`);
        const data = await res.json();
        const result = data.chart.result[0];
        
        const closes = result.indicators.quote[0].close;
        closes[closes.length - 1] = result.meta.regularMarketPrice; // 현재가 업데이트

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

        // 3. 상황 판단 로직 (원본 Scriptable 코드와 문구 일치시킴)
        let status = "";
        let action = "";
        let color = "";

        // 로직 순서도 원본과 동일하게 맞춤
        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            status = "상승 신호!"; 
            action = "내일 종가 확인 후 진입"; 
            color = "#fd8a69"; // Buy Color
        } 
        else if (currentPrice > envelope) {
            status = "과열 상황"; 
            action = "TQQQ 유지 / SPYM 추가매수"; 
            color = "#b96bc6"; // Maintain Color
        } 
        else if (currentPrice > currentMA200) {
            status = "집중 투자 상황"; 
            action = "SGOV 매도 / TQQQ 매수"; 
            color = "#fd8a69"; // Buy Color
        } 
        else {
            status = "하락 상황"; 
            action = "SPYM TQQQ 매도 / SGOV 매수"; 
            color = "#58ccff"; // Sell Color
        }

        // 편차(Deviation) 계산 추가
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;
        const finalStatus = `${status} ${deviationText}`;

        // 4. 차트 URL 생성
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
            status: finalStatus, // 편차 포함된 상태 메시지
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