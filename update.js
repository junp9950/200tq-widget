const fs = require('fs');

// ==========================================
// [설정값]
// ==========================================
const TICKER = "TQQQ";
const ENV_PERCENT = 1.1; // 10% 설정
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

        // 3. 색상 팔레트 (이미지 기반)
        const COLORS = { 
            white: "#FFFFFF",    // 종목명
            orange: "#FFAB40",   // 매수, 진입, 집중
            purple: "#b96bc6",   // 과열, 유지, 엔벨로프
            blue: "#58ccff",     // 매도, 하락, 현재가
            green: "#76E383",    // 상승 신호
            ma200: "#AFD485",    // 200일선
            gray: "#aaaaaa"      // 보조 텍스트
        };

        // 4. 상황 판단 및 텍스트 생성 (단어별 색상 적용)
        let statusRich = "";
        let actionRich = "";
        
        const deviation = ((currentPrice / currentMA200) - 1) * 100;
        const deviationText = `(${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%)`;

        // [로직] 상황별 멘트와 색상 조합
        if (currentPrice > currentMA200 && prevPrice <= prevMA200) {
            // 상승 신호
            statusRich = `[c=${COLORS.green}]상승 신호![/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            actionRich = `내일 종가 확인 후 [c=${COLORS.orange}]진입[/c]`;
        } 
        else if (currentPrice > envelope) {
            // 과열 상황 (이미지 예시 상황)
            statusRich = `[c=${COLORS.gray}]과열 상황[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            // "TQQQ(흰색) 유지(보라) / SPYM(흰색) 추가매수(오렌지)"
            actionRich = `TQQQ [c=${COLORS.purple}]유지[/c] / SPYM [c=${COLORS.orange}]추가매수[/c]`;
        } 
        else if (currentPrice > currentMA200) {
            // 집중 투자
            statusRich = `[c=${COLORS.orange}]집중 투자 상황[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            // "SGOV(흰색) 매도(파랑) / TQQQ(흰색) 매수(오렌지)"
            actionRich = `SGOV [c=${COLORS.blue}]매도[/c] / TQQQ [c=${COLORS.orange}]매수[/c]`;
        } 
        else {
            // 하락 상황
            statusRich = `[c=${COLORS.blue}]하락 상황[/c] [c=${COLORS.gray}]${deviationText}[/c]`;
            // "SPYM TQQQ(흰색) 매도(파랑) / SGOV(흰색) 매수(오렌지)"
            actionRich = `SPYM TQQQ [c=${COLORS.blue}]매도[/c] / SGOV [c=${COLORS.orange}]매수[/c]`;
        }

        // 5. 가격표 색상 (현재가:파랑 / 엔벨:보라 / 200선:연두)
        const pricesRich = `[c=${COLORS.blue}]$${currentPrice.toFixed(2)}[/c] / [c=${COLORS.purple}]$${envelope.toFixed(2)}[/c] / [c=${COLORS.ma200}]$${currentMA200.toFixed(2)}[/c]`;

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
                    // 현재가 선: 파란색
                    { data: closes.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.blue, borderWidth: 2, pointRadius: 0, fill: false },
                    // 200일선: 연두색
                    { data: ma200.slice(-sliceCnt).map(v=>Number(v.toFixed(2))), borderColor: COLORS.ma200, borderWidth: 2, pointRadius: 0, fill: false },
                    // 엔벨로프: 보라색 점선
                    { data: ma200.slice(-sliceCnt).map(v=>Number((v * ENV_PERCENT).toFixed(2))), borderColor: COLORS.purple, borderWidth: 1, pointRadius: 0, fill: false, borderDash: [5,5] }
                ]
            },
            options: { 
                legend: { display: false }, 
                scales: { yAxes: [{ display: false }], xAxes: [{ display: false }] },
                layout: { padding: 10 }
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
        console.log("Updated with specific word coloring.");

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();