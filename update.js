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
        let color = ""; 

        // [색상 정의] 지웅님 요청 반영 (다크모드용 밝은 컬러)
        const COLORS = { 
            rising: "#76E383",   // 상승=연초록 (Green Light)
            focused: "#FFAB40",  // 집중=오렌지 (Active)
            overheat: "#b96bc6", // 과열=보라 (Warning)
            falling: "#58ccff",  // 하락=파랑 (Cool)
            gray: "#aaaaaa",
            ma200: "#AFD485"     // 차트용 200일선 (연두)
        };

        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            status = "상승 신호!"; 
            action = "내일 종가 확인 후 진입"; 
            color = COLORS.rising; // 연초록
        } 
        else if (currentPrice > envelope) {
            status = "과열 상황"; 
            action = "TQQQ 유지 / SPYM 추가매수"; 
            color = COLORS.overheat; // 보라
        } 
        else if (currentPrice > currentMA200) {
            status = "집중 투자 상황"; 
            action = "SGOV 매도 / TQQQ 매수"; 
            color = COLORS.focused; // 오렌지
        } 
        else {
            status = "하락 상황"; 
            action = "SPYM TQQQ 매도 / SGOV 매수"; 
            color = COLORS.falling; // 파랑
        }

        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

        // 텍스트 생성 (상황별 색상 적용)
        const statusRich = `[c=${color}]${status}[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
        const actionRich = `[c=${color}]${action}[/c]`;
        
        // 가격표 색상
        const pricesRich = `[c=${COLORS.falling}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.overheat}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;

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
                    // 현재가 선: 파란색 통일 (보통 차트에서 캔들은 파랑/빨강이지만 선은 하나로 감)
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.falling, borderWidth: 2, pointRadius: 0, fill: false },
                    // 200일선: 연두색
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    // 엔벨로프: 보라색 점선
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v * ENV_PERCENT).toFixed(2))), borderColor: COLORS.overheat, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
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
        console.log("Updated with Custom Colors (Green/Purple/Orange/Blue)");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();