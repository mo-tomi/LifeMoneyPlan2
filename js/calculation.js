/**
生涯収支シミュレーター - 計算エンジン・結果表示システム
生涯収支計算、結果表示、チャート、アドバイス生成
*/
// ===== 計算補助関数 =====
const getPensionAmountForYear = (age, retirementAge) => {
// 年金受給開始年齢（原則65歳。リタイアが65歳以降ならリタイア年齢から）
const pensionStartAge = Math.max(65, retirementAge);
return age >= pensionStartAge ? PensionManager.getPensionAmount() * 12 : 0;
};
const getIncomeForYear = (age, retirementAge) => {
if (age < retirementAge) {
return (appState.basicInfo.income || 0) * 12;
}
return getPensionAmountForYear(age, retirementAge);
};
const getFixedCostsForYear = () => {
let total = Object.values(appState.fixedCosts)
.reduce((sum, cost) => (cost.isActive && cost.amount > 0) ? sum + (cost.amount * 12) : sum, 0);
// 固定費が0の場合の最低生活費（手取りの30%か15万円の大きい方、年額）
if (total === 0 && Object.values(appState.fixedCosts).every(c => !c.isActive || c.amount === 0)) {
const minLivingCost = Math.max((appState.basicInfo.income || 0) * 0.3, 15) * 12;
total = minLivingCost > 0 ? minLivingCost : 15 * 12; // 最低でも15万円/月
}
return total;
};
const getLifeEventCostForYear = (age, currentAge) => {
let eventCosts = 0;
// 標準ライフイベント
APP_DATA.lifeEvents.forEach(event => {
if (!appState.lifeEvents[event.key]) return;
switch (event.key) {
case "marriage":
if (age === Math.max(currentAge + 2, 25) && event.isOneTime) eventCosts += event.cost;
break;
case "car":
const carStartAge = Math.max(currentAge + 3, 20);
if (age >= carStartAge) {
if ((age - carStartAge) % (event.costInterval || 10) === 0) eventCosts += event.cost;
if (event.recurringCostPerYear) eventCosts += event.recurringCostPerYear;
}
break;
case "children":
const childrenCount = appState.detailSettings.childrenCount || 0;
if (childrenCount > 0) {
const firstChildBirthAge = Math.max(currentAge + 2, 25);
for (let i = 0; i < childrenCount; i++) {
const childBirthYearAge = firstChildBirthAge + (i * 2); // 各子供の出産時の親の年齢
const childAgeInCurrentYear = age - childBirthYearAge;
if (childAgeInCurrentYear >= 0 && childAgeInCurrentYear < 22) {
eventCosts += (event.cost / 22); // 1人あたり年間費用
}
}
}
break;
case "housing":
const housingPurchaseAge = appState.detailSettings.housingAge;
if (age === housingPurchaseAge && event.isOneTime) eventCosts += event.cost;
if (age > housingPurchaseAge) eventCosts += event.cost * 0.005; // 固定資産税等
break;
case "caregiving":
const careStartBaseAge = Math.max(currentAge, 50); // 介護開始のベース年齢
const actualCareStartAge = Math.max(careStartBaseAge, 55); // 50歳かつ55歳以上
if (age === actualCareStartAge && event.cost) eventCosts += event.cost; // 一時金
if (age >= actualCareStartAge && event.recurringCostPerYear) eventCosts += event.recurringCostPerYear;
break;
case "travel":
const travelStartAge = Math.max(currentAge + 5, 25);
if (age >= travelStartAge && (age - travelStartAge) % (event.costInterval || 5) === 0) {
eventCosts += event.cost;
}
break;
}
});
// カスタムライフイベント
appState.customLifeEvents.forEach(customEvent => {
if (customEvent.age === age) eventCosts += customEvent.amount;
});
return eventCosts;
};
const getNisaInvestmentForYear = (age, retirementAge) => {
if (appState.lifeEvents.nisa && age < retirementAge && appState.detailSettings.nisaAmount > 0) {
return appState.detailSettings.nisaAmount * 12;
}
return 0;
};
// ===== 計算エンジン =====
const CalculationEngine = {
async calculate() {
try {
appState.isCalculating = true;
UIManager.showLoading();
FormManager.saveCurrentStepData(); // 最終ステップのデータも保存
await new Promise(resolve => setTimeout(resolve, APP_CONFIG.CALCULATION_DELAY / 2)); // 少し短縮
const results = this.performCalculation();
        if (!results || results.yearlyData.length === 0) throw new Error('計算結果が無効です');

        appState.results = results;
        appState.currentStep = 5; // 結果表示ステップへ
        appState.farthestValidatedStep = Math.max(appState.farthestValidatedStep, 5);

        UIManager.hideLoading();
        UIManager.showStep(5);
        ResultsManager.render();
        UIManager.updatePlaceholders(true);
        NotificationManager.show('計算が完了しました！', 'success');
    } catch (error) {
        UIManager.hideLoading();
        Utils.handleError(error, 'Calculation');
    } finally {
        appState.isCalculating = false;
    }
},

performCalculation() {
    const currentAge = Utils.calculateAge(appState.basicInfo.birthday);
    if (currentAge === null) throw new Error('年齢が計算できません');

    const { retirementAge, expectedLifeExpectancy, investmentReturnRate } = appState.advancedSettings;
    const invRate = (investmentReturnRate || 0) / 100; // nullチェック追加

    let totalIncome = 0, totalExpenses = 0;
    let nisaBalance = 0, cashBalance = 0;
    const yearlyData = [];

    for (let age = currentAge; age <= expectedLifeExpectancy; age++) {
        const income = getIncomeForYear(age, retirementAge);
        const fixedCosts = getFixedCostsForYear();
        const lifeEventCosts = getLifeEventCostForYear(age, currentAge);
        const cashExpense = fixedCosts + lifeEventCosts;
        const nisaInvestment = getNisaInvestmentForYear(age, retirementAge);

        totalIncome += income;
        totalExpenses += cashExpense; // NISA投資は支出に含めない

        nisaBalance = (nisaBalance + nisaInvestment) * (1 + invRate);
        const netCashFlow = income - cashExpense - nisaInvestment;
        cashBalance += netCashFlow;

        yearlyData.push({
            age, income, cashExpense, nisaInvestment, netCashFlow,
            cumulativeCash: cashBalance, nisaBalance,
            totalAssets: cashBalance + nisaBalance
        });
    }

    const finalBalance = cashBalance + nisaBalance;
    const retirementData = yearlyData.find(d => d.age === retirementAge) || yearlyData[yearlyData.length - 1];
    const avgAnnualIncome = yearlyData.length > 0 ? totalIncome / yearlyData.length : (appState.basicInfo.income || 360) * 12;


    return {
        totalIncome, totalExpenses, finalBalance,
        retirementAssets: retirementData?.totalAssets || 0,
        retirementCash: retirementData?.cumulativeCash || 0,
        retirementNisa: retirementData?.nisaBalance || 0,
        nisaFinalContribution: yearlyData.reduce((sum, d) => sum + d.nisaInvestment, 0),
        nisaFinalBalance: nisaBalance,
        yearlyData,
        rating: this.calculateRating(finalBalance, avgAnnualIncome),
        averageIncome: avgAnnualIncome,
        generationRank: this.calculateGenerationRank(finalBalance, currentAge)
    };
},

calculateRating(finalBalance, avgAnnualIncome) {
    if (avgAnnualIncome <= 0) return 'D'; // 平均年収0以下はD
    const ratio = finalBalance / avgAnnualIncome;
    if (ratio >= 5) return 'S';
    if (ratio >= 2) return 'A';
    if (ratio >= 0) return 'B';
    if (ratio >= -1) return 'C';
    return 'D';
},

calculateGenerationRank(finalBalance, currentAge) {
    let generationKey = '60s'; // デフォルト
    if (currentAge < 30) generationKey = '20s';
    else if (currentAge < 40) generationKey = '30s';
    else if (currentAge < 50) generationKey = '40s';
    else if (currentAge < 60) generationKey = '50s';

    const generationAssets = GENERATION_DATA[generationKey]?.averageAssets || 0;
    if (generationAssets <= 0) return 50; // 比較対象がない場合は中央値

    // 簡易的なパーセンタイル計算（正規分布を仮定）
    // 実際にはより複雑な分布になるが、ここでは簡略化
    // (値 - 平均) / 標準偏差 * 15 + 50  (標準偏差を平均の1/3と仮定)
    const stdDev = generationAssets / 3;
    let percentile = ((finalBalance - generationAssets) / (stdDev || 1)) * 15 + 50;
    return Math.max(1, Math.min(99, Math.round(percentile))); // 1-99%に収める
}

};
// ===== 結果表示管理システム =====
const ResultsManager = {
render() {
this.renderRatingAndSummary();
this.renderSummaryCards();
this.renderChart();
this.renderAdvice();
this.renderGenerationCompare();
},
renderRatingAndSummary() {
    const { rating, finalBalance, generationRank } = appState.results;
    const { expectedLifeExpectancy } = appState.advancedSettings;

    const ratingTexts = { S: '素晴らしい未来設計！', A: '堅実な家計プラン！', B: '安定した見通し。', C: 'やや注意が必要。', D: '家計改善を検討しましょう。' };
    Utils.getElement('ratingDisplay', false).innerHTML = `<div class="rating-badge rating-${rating.toLowerCase()}">${rating}</div>`;

    let summaryText = `あなたの生涯収支評価は <strong>「${rating}」</strong>！ ${ratingTexts[rating]}<br>`;
    summaryText += `${expectedLifeExpectancy}歳時点の予測総資産は <strong>${Utils.formatCurrency(finalBalance)}</strong>。`;
    summaryText += `これは同世代の中で上位約<strong>${100 - generationRank}%</strong>に位置します。`; // 修正: 上位%表示
    if (finalBalance < 0) summaryText += ' 資金計画の見直しを。';
    else summaryText += ' この調子で資産形成を！';
    Utils.getElement('resultsMainSummary', false).innerHTML = `<p>${summaryText}</p>`;
},

renderSummaryCards() {
    const { totalIncome, totalExpenses, finalBalance, retirementAssets } = appState.results;
    const { expectedLifeExpectancy, retirementAge } = appState.advancedSettings;
    const cardsData = [
        { icon: '💰', label: '生涯総収入', value: totalIncome, positive: true },
        { icon: '💸', label: '生涯総支出', value: totalExpenses, positive: false },
        { icon: finalBalance >= 0 ? '📈' : '📉', label: `${expectedLifeExpectancy}歳時資産`, value: finalBalance, positive: finalBalance >= 0 },
        { icon: '🏖️', label: `${retirementAge}歳時資産`, value: retirementAssets, positive: retirementAssets >= 0 }
    ];
    Utils.getElement('resultsSummaryCards', false).innerHTML = cardsData.map(card => `
        <div class="result-card">
            <div class="result-icon">${card.icon}</div>
            <div class="result-label">${card.label}</div>
            <div class="result-value ${card.positive ? 'positive' : 'negative'}">${Utils.formatCurrency(card.value)}</div>
        </div>`).join('');
},

renderChart() {
    const ctx = Utils.getElement('lifetimeChart', false)?.getContext('2d');
    if (!ctx) return;
    if (lifetimeChart) lifetimeChart.destroy();

    const data = appState.results.yearlyData;
    if (!data || data.length === 0) { UIManager.updatePlaceholders(false); return; }
    UIManager.updatePlaceholders(true);

    const datasets = [
        { label: '総資産', data: data.map(d => d.totalAssets), borderColor: 'var(--color-primary-500)', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.1 },
        { label: '現金', data: data.map(d => d.cumulativeCash), borderColor: 'var(--color-warning-500)', fill: false, borderDash: [5, 5], tension: 0.1 },
    ];
    if (appState.lifeEvents.nisa && appState.results.nisaFinalBalance > 0.1) { // 0.1万円以上で表示
        datasets.push({ label: 'NISA', data: data.map(d => d.nisaBalance), borderColor: 'var(--color-success-500)', fill: false, borderDash: [2, 2], tension: 0.1 });
        Utils.getElement('nisaLegendItem', false).style.display = 'flex'; // 凡例表示
    } else {
        Utils.getElement('nisaLegendItem', false).style.display = 'none'; // 凡例非表示
    }

    lifetimeChart = new Chart(ctx, {
        type: 'line',
        data: { labels: data.map(d => d.age), datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: {
                y: { ticks: { callback: value => Utils.formatCurrency(value) } },
                x: { title: { display: true, text: '年齢' } }
            },
            plugins: {
                tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Utils.formatCurrency(c.parsed.y)}`, title: items => `${items[0].label}歳時点` } },
                legend: { display: false } // カスタム凡例を使用するため非表示
            },
            elements: { point: { radius: (context) => (context.dataIndex % 5 === 0 || context.dataIndex === data.length -1) ? 3 : 0 } } // 5年ごとに点を表示
        }
    });
},

renderAdvice() {
    const container = Utils.getElement('adviceContent', false);
    if (!container) return;
    container.innerHTML = ''; // クリア
    const adviceList = this.generateAdviceList();
    if (adviceList.length === 0) {
        container.innerHTML = `<div class="advice-item type-info">特に目立った課題はありません。定期的な見直しを。</div>`;
        UIManager.updatePlaceholders(true); // アドバイスコンテナ自体は表示
        container.style.display = 'block';
        return;
    }
    adviceList.forEach(advice => {
        const el = createItemElement('div', `advice-item priority-${advice.priority || 'medium'}`, `
            <div class="advice-header">
                <span class="advice-priority-icon">${advice.icon || '💡'}</span>
                <div class="advice-content">
                    <h5 class="advice-title-text">${advice.title}</h5>
                    <p class="advice-description">${advice.text}</p>
                    ${advice.action ? `<div class="advice-action">${advice.action}</div>` : ''}
                </div>
            </div>`);
        container.appendChild(el);
    });
    UIManager.updatePlaceholders(true);
    container.style.display = 'block';
},

generateAdviceList() {
    const { results, basicInfo, fixedCosts, lifeEvents, advancedSettings, detailSettings } = appState;
    const advice = [];
    const add = (title, text, priority = 'medium', icon = '💡', action = '') => advice.push({ title, text, priority, icon, action });

    // 総合評価
    if (results.rating === 'S' || results.rating === 'A') add('総合評価', `素晴らしい資産計画です！${advancedSettings.expectedLifeExpectancy}歳時資産 <strong>${Utils.formatCurrency(results.finalBalance)}</strong>。安定した未来が期待できます。`, 'low', '🏆');
    else if (results.rating === 'B') add('総合評価', `堅実な計画ですが改善の余地あり。${advancedSettings.expectedLifeExpectancy}歳時資産 <strong>${Utils.formatCurrency(results.finalBalance)}</strong>。`, 'medium', '👍');
    else add('総合評価', `計画見直し推奨。${advancedSettings.expectedLifeExpectancy}歳時資産 <strong>${Utils.formatCurrency(results.finalBalance)}</strong>。具体的な改善策を検討しましょう。`, 'high', '⚠️');

    // 固定費
    const totalMonthlyFixedCosts = Object.values(fixedCosts).reduce((sum, cost) => cost.isActive ? sum + cost.amount : sum, 0);
    const incomeRatio = basicInfo.income > 0 ? (totalMonthlyFixedCosts / basicInfo.income) * 100 : 0;
    if (incomeRatio > 50) add('固定費', `月固定費(<strong>${Utils.formatCurrency(totalMonthlyFixedCosts)}</strong>)が収入の<strong>${incomeRatio.toFixed(0)}%</strong>と高め。見直しを。`, 'high', '💸', '固定費の見直しポイントを確認する');
    else if (incomeRatio > 30 && incomeRatio <=50) add ('固定費', `月固定費は収入の<strong>${incomeRatio.toFixed(0)}%</strong>。理想は30%以下です。`, 'medium', '💳');

    // 食費警告（要件より）
    if (fixedCosts.food?.amount > 6) add('食費', `食費が月6万円を超えています。外食回数や自炊の工夫で節約できる可能性があります。`, 'medium', '🍽️');


    // 投資
    if (lifeEvents.nisa && detailSettings.nisaAmount > 0) {
        if (results.nisaFinalBalance > 0) add('NISA・投資', `NISA等(月<strong>${Utils.formatCurrency(detailSettings.nisaAmount)}</strong>, 利回り<strong>${advancedSettings.investmentReturnRate}%</strong>)は将来資産に貢献。最終評価額<strong>${Utils.formatCurrency(results.nisaFinalBalance)}</strong>。`, 'low', '📈', 'NISAの詳細情報を見る');
        if (advancedSettings.investmentReturnRate < 2 && results.nisaFinalBalance > 0) add('投資戦略', `期待利回り(<strong>${advancedSettings.investmentReturnRate}%</strong>)は保守的。リスク許容度に応じ、より高いリターンも検討の余地あり。`, 'medium', '🤔');
    } else add('NISA・投資', `積立投資は未計画。少額からでも始め、複利効果で将来資産増を目指しましょう。`, 'medium', '💡', 'NISA制度について調べる');

    // リタイア計画
    if (advancedSettings.retirementAge < 65 && results.retirementAssets < 0) add('リタイア計画', `早期リタイア(<strong>${advancedSettings.retirementAge}歳</strong>)希望ですが資金不足の可能性。リタイア時期の見直しや対策を。`, 'high', '🏖️');

    // 住宅購入
    if (lifeEvents.housing && detailSettings.housingAge) add('住宅購入', `住宅購入(<strong>${detailSettings.housingAge}歳</strong>)は大きな支出。頭金やローン計画をしっかり。`, 'medium', '🏠');

    return advice;
},

renderGenerationCompare() {
    const container = Utils.getElement('generationCompareSection'); // HTMLにこのIDの要素が必要
    if (!container) return;

    const { generationRank, finalBalance } = appState.results;
    const currentAge = Utils.calculateAge(appState.basicInfo.birthday);
    let generationKey = '60s';
    if (currentAge < 30) generationKey = '20s';
    else if (currentAge < 40) generationKey = '30s';
    else if (currentAge < 50) generationKey = '40s';
    else if (currentAge < 60) generationKey = '50s';

    const avgAssets = GENERATION_DATA[generationKey]?.averageAssets || 0;
    const diff = finalBalance - avgAssets;

    container.innerHTML = `
        <h4 class="comparison-title">同世代との比較 (${generationKey.replace('s','代')})</h4>
        <div class="comparison-content">
            <p>あなたの最終予測資産は、同世代の中で上位約 <strong>${100 - generationRank}%</strong> に位置します。</p>
            <p>同世代平均資産 (${Utils.formatCurrency(avgAssets)}) と比較して、
            <strong>${Utils.formatCurrency(Math.abs(diff))} ${diff >=0 ? '多くなっています' : '少なくなっています'}</strong>。</p>
            ${diff < 0 && generationRank > 50 ? '<p class="improvement-tip">さらなる資産形成のチャンスがあります！固定費削減や投資額増額を検討してみましょう。</p>' : ''}
            ${diff >= 0 && generationRank <= 30 ? '<p class="good-status">素晴らしいです！引き続き計画的な資産運用を心がけましょう。</p>' : ''}
        </div>
    `;
},
generateAdviceSummaryText(results) { // app-init.jsから呼び出される可能性を考慮
    if (!results || !results.rating) return 'アドバイスが生成されていません。';
    const { rating } = results;
    if (rating === 'S' || rating === 'A') return '優秀な家計プランです。現在の計画を継続することで、安定した将来を迎えられるでしょう。';
    if (rating === 'B') return '基本的には堅実なプランですが、より余裕を持つために一部見直しを検討してみてください。';
    return '現在のプランでは将来の資金が不足する可能性があります。収入増、支出減、投資強化などの改善策を検討することをおすすめします。';
}

};
if (typeof module !== 'undefined' && module.exports) {
module.exports = { CalculationEngine, ResultsManager };
}