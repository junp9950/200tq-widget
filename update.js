const fs = require('fs');

// ==========================================
// [설정값] 여기만 고치면 전체 로직에 반영됩니다.
// ==========================================
const TICKER = "TQQQ";
const ENV_PERCENT = 1.1; // 10% 설정 (1.1)
// ==========================================

async function main() {
    try {
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
        
        // [설정값 적용] 상수를 사용하여 계산
        const envelope = currentMA200 * ENV_PERCENT;

        // 3. 상황 판단 로직
        let status = "";
        let action = "";
        let color = "";

        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            status = "상승 신호!"; 
            action = "내일 종가 확인 후 진입"; 
            color = "#fd8a69"; 
        } 
        else if (currentPrice > envelope) {
            status = "과열 상황"; 
            action = "TQQQ 유지 / SPYM 추가매수"; 
            color = "#b96bc6"; 
        } 
        else if (currentPrice > currentMA200) {
            status = "집중 투자 상황"; 
            action = "SGOV 매도 / TQQQ 매수"; 
            color = "#fd8a69"; 
        } 
        else {
            status = "하락 상황"; 
            action = "SPYM TQQQ 매도 / SGOV 매수"; 
            color = "#58ccff"; 
        }

        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

        // 색상 정의
        const COLORS = { price: "#58ccff", env: "#b96bc6", ma200: "#AFD485", gray: "#aaaaaa" };

        // BBCode 텍스트 생성
        const actionRich = `[c=${color}]${action}[/c]`;
        const pricesRich = `[c=${COLORS.price}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.env}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;
        const statusRich = `${status} [c=${COLORS.gray}]${deviationText}[/c]`;

        // 날짜
        const today = new Date();
        const dateStr = `${today.getFullYear().toString().slice(2)}. ${today.getMonth()+1}. ${today.getDate()}. 종가 기준`;

        // 4. 차트 생성
        const sliceCnt = 90;
        const chartData = {
            type: 'line',
            data: {
                labels: new Array(sliceCnt).fill(''),
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.price, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    
                    // [설정값 적용] 차트 그릴 때도 상수 사용
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v * ENV_PERCENT).toFixed(2))), borderColor: COLORS.env, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { 
                legend: { display: false }, 
                // [디자인 개선] 차트 눈금/숫자 숨기기
                scales: { 
                    yAxes: [{ display: false }], 
                    xAxes: [{ display: false }] 
                },
                layout: { padding: 10 }
            }
        };
        const chartUrl = `https://quickchart.io/chart?w=600&h=350&bkg=black&c=${encodeURIComponent(JSON.stringify(chartData))}`;

        // 5. 결과 저장
        const output = {
            title: "TQQQ SMA 200days", // 지웅님이 원하신 제목 적용됨
            date: dateStr,
            status: statusRich,
            action: actionRich,
            prices: pricesRich,
            chartUrl: chartUrl,
            updated: new Date().toISOString()
        };
        
        fs.writeFileSync('result.json', JSON.stringify(output));
        console.log("Updated with ENV_PERCENT: " + ENV_PERCENT);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();