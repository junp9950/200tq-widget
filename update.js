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
        
        const timestamps = result.timestamp; // [추가] 날짜 데이터 가져오기
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
            rising: "#76E383",   
            focused: "#FFAB40",  
            overheat: "#b96bc6", 
            falling: "#58ccff",  
            ma200: "#AFD485",    
            gray: "#aaaaaa"      
        };

        // 4. 상황 판단 및 텍스트 생성
        let statusRich = "";
        let actionRich = "";
        
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

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
        
        // [추가] X축 라벨 생성 (Timestamp -> "MM/DD" 포맷 변환)
        const chartLabels = timestamps.slice(-sliceCnt).map(ts => {
            const d = new Date(ts * 1000);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });

        const chartData = {
            type: 'line',
            data: {
                labels: chartLabels, // [수정] 실제 날짜 데이터 주입
                datasets: [
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.falling, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v * ENV_PERCENT).toFixed(2))), borderColor: COLORS.overheat, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { 
                legend: { display: false }, 
                scales: { 
                    yAxes: [{ 
                        display: true,
                        position: 'right',
                        ticks: { fontColor: '#cccccc', fontSize: 10, padding: 5 },
                        gridLines: { display: false, drawBorder: false }
                    }], 
                    // [수정] X축(날짜) 활성화 및 설정
                    xAxes: [{ 
                        display: true, 
                        ticks: { 
                            fontColor: '#cccccc', 
                            fontSize: 10,
                            maxTicksLimit: 4, // [중요] 최대 4개까지만 표시 (겹침 방지)
                            maxRotation: 0    // 글자 회전 방지
                        },
                        gridLines: { display: false, drawBorder: false }
                    }] 
                },
                layout: { 
                    padding: { top: 10, bottom: 10, left: 10, right: 30 } 
                }
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
        console.log("Updated: X-Axis Date Labels Added");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();