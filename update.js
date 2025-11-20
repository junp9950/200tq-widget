const fs = require('fs');

// ==========================================
// [설정값]
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
        const envelope = currentMA200 * ENV_PERCENT;

        // 3. 색상 팔레트
        const COLORS = { 
            white: "#FFFFFF",    
            rising: "#76E383",   // 상승=연초록
            focused: "#FFAB40",  // 집중=오렌지
            overheat: "#b96bc6", // 과열=보라
            falling: "#58ccff",  // 하락=파랑
            ma200: "#AFD485",    
            gray: "#aaaaaa"      
        };

        // 4. 상황 판단 및 텍스트 생성
        let statusRich = "";
        let actionRich = "";
        
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

        // [로직] 상황별 멘트 색상 + 줄바꿈(\n)
        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            statusRich = `[c=${COLORS.rising}]상승 신호![/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            actionRich = `내일 종가 확인 후 [c=${COLORS.focused}]진입[/c]`;
        } 
        else if (currentPrice > envelope) {
            statusRich = `[c=${COLORS.overheat}]과열 상황[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            actionRich = `TQQQ [c=${COLORS.overheat}]유지[/c]\nSPYM [c=${COLORS.focused}]추가매수[/c]`;
        } 
        else if (currentPrice > currentMA200) {
            statusRich = `[c=${COLORS.focused}]집중 투자 상황[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            actionRich = `SGOV [c=${COLORS.falling}]매도[/c]\nTQQQ [c=${COLORS.focused}]매수[/c]`;
        } 
        else {
            statusRich = `[c=${COLORS.falling}]하락 상황[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            actionRich = `SPYM TQQQ [c=${COLORS.falling}]매도[/c]\nSGOV [c=${COLORS.focused}]매수[/c]`;
        }

        // 5. 가격표
        const pricesRich = `[c=${COLORS.falling}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.overheat}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;

        // 6. 날짜
        const today = new Date();
        const dateStr = `${today.getFullYear().toString().slice(2)}. ${today.getMonth()+1}. ${today.getDate()}. 종가 기준`;

        // 7. 차트 생성
        const sliceCnt = 90;
        const chartData = {
            type: 'line',
            data: {
                labels: new Array(sliceCnt).fill(''),
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.falling, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v * ENV_PERCENT).toFixed(2))), borderColor: COLORS.overheat, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { 
                legend: { display: false }, 
                // [디자인 수정] Y축(가격) 눈금 표시
                scales: { 
                    yAxes: [{ 
                        display: true,             // Y축 보이기
                        position: 'right',         // 오른쪽에 배치 (트레이딩 뷰 스타일)
                        ticks: { 
                            fontColor: '#888888',  // 눈금 색상 (회색)
                            fontSize: 10           // 글자 크기
                        },
                        gridLines: {
                            display: false,        // 격자무늬는 끔 (지저분함 방지)
                            drawBorder: false      // 테두리 선 제거
                        }
                    }], 
                    xAxes: [{ display: false }]    // X축(날짜)은 너무 많아서 숨김
                },
                layout: { padding: { top: 10, bottom: 10, left: 0, right: 5 } }
            }
        };
        const chartUrl = `https://quickchart.io/chart?w=600&h=350&bkg=black&c=${encodeURIComponent(JSON.stringify(chartData))}`;

        // 8. 결과 저장
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
        console.log("Updated: Chart with Y-Axis Scales");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();