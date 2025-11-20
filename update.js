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
        
        // [설정값 적용]
        const envelope = currentMA200 * ENV_PERCENT;

        // 3. 상황 판단 로직
        let status = "";
        let action = "";
        let color = ""; // 이 변수가 상황별 대표 색상이 됩니다.

        // 색상 정의 (파스텔톤)
        const COLORS = { 
            up: "#fd8a69",    // 상승 (연빨강)
            down: "#58ccff",  // 하락 (하늘색)
            warn: "#b96bc6",  // 과열 (보라색)
            gray: "#aaaaaa",  // 보조 (회색)
            ma200: "#AFD485"  // 200일선 (연두색)
        };

        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            status = "상승 신호!"; 
            action = "내일 종가 확인 후 진입"; 
            color = COLORS.up; // 빨강
        } 
        else if (currentPrice > envelope) {
            status = "과열 상황"; 
            action = "TQQQ 유지 / SPYM 추가매수"; 
            color = COLORS.warn; // 보라
        } 
        else if (currentPrice > currentMA200) {
            status = "집중 투자 상황"; 
            action = "SGOV 매도 / TQQQ 매수"; 
            color = COLORS.up; // 빨강
        } 
        else {
            status = "하락 상황"; 
            action = "SPYM TQQQ 매도 / SGOV 매수"; 
            color = COLORS.down; // 파랑
        }

        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

        // ============================================================
        // [핵심 수정] status 멘트 자체에 색상(color)을 입힘
        // ============================================================
        const statusRich = `[c=${color}]${status}[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
        const actionRich = `[c=${color}]${action}[/c]`;
        
        // 가격표 색상 (여기는 고정색 사용)
        const pricesRich = `[c=${COLORS.down}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.warn}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;


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
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.down, borderWidth: 2, pointRadius: 0, fill: false }, // 현재가는 파랑(Cyan) 계열로 통일
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v * ENV_PERCENT).toFixed(2))), borderColor: COLORS.warn, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
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
        console.log("Updated with Color logic.");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();