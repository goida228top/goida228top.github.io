
import * as Dom from './dom.js';
import { t } from './lang.js';
import { savePlayer_Data, showRewardedVideo } from './yandex.js';
import { SoundManager } from './sound.js';
import { addTapListener, showToast, playerData } from './ui_common.js';

export function updateCoinsDisplay() {
    Dom.coinsCountSpan.textContent = playerData.coins;
    localStorage.setItem('coins', playerData.coins);
    localStorage.setItem('rewardProgress', JSON.stringify(playerData.rewardProgress));
    localStorage.setItem('unlockedSlots', JSON.stringify(playerData.unlockedSlots));
}

export function updateRewardButtonUI(button, engineData) {
    if (!button) return;
    const rewardAmount = parseInt(button.getAttribute('data-reward'));
    const adsRequired = parseInt(button.getAttribute('data-ads'));
    const currentProgress = playerData.rewardProgress[rewardAmount] || 0;

    button.innerHTML = '';
    const topInfo = document.createElement('div');
    topInfo.className = 'reward-info-top';
    const header = document.createElement('div');
    header.className = 'reward-button-header';
    header.textContent = `${currentProgress}/${adsRequired}`;
    topInfo.appendChild(header);
    const imgContainer = document.createElement('div');
    imgContainer.className = 'reward-button-coins-container';
    const img = document.createElement('img');
    img.className = 'reward-tier-image';
    if (rewardAmount === 10) img.src = 'https://goida228top.github.io/textures/10 монет.png';
    else if (rewardAmount === 50) img.src = 'https://goida228top.github.io/textures/50 монет.png';
    else img.src = 'https://goida228top.github.io/textures/100 монет.png';
    imgContainer.appendChild(img);
    topInfo.appendChild(imgContainer);
    const subTitle = document.createElement('div');
    subTitle.className = 'reward-button-subtitle';
    subTitle.textContent = t('reward-amount-label', { amount: rewardAmount });
    topInfo.appendChild(subTitle);
    button.appendChild(topInfo);
    const actionBtn = document.createElement('button');
    actionBtn.className = 'reward-progress-btn';
    
    if (currentProgress >= adsRequired) {
        actionBtn.classList.add('ready-to-claim');
        actionBtn.textContent = t('claim-reward');
        addTapListener(actionBtn, (e) => {
            e.stopPropagation();
            playerData.coins += rewardAmount;
            playerData.rewardProgress[rewardAmount] = 0;
            updateCoinsDisplay();
            savePlayer_Data(playerData);
            SoundManager.playSound('reward');
            showToast(t('reward-claimed'), 'success');
            updateRewardButtonUI(button, engineData);
        });
    } else {
        actionBtn.textContent = t('watch-ad-button', { progress: `${currentProgress}/${adsRequired}` });
        const icon = document.createElement('img');
        icon.className = 'ad-icon';
        icon.src = 'https://goida228top.github.io/textures/реклама.png';
        actionBtn.appendChild(icon);
        addTapListener(actionBtn, (e) => {
            e.stopPropagation();
            actionBtn.disabled = true;
            actionBtn.classList.add('watching-ad');
            actionBtn.textContent = t('loading-ad');
            showRewardedVideo(engineData, () => {
                playerData.rewardProgress[rewardAmount] = currentProgress + 1;
                savePlayer_Data(playerData);
                updateRewardButtonUI(button, engineData);
            }, () => {
                actionBtn.disabled = false;
                actionBtn.classList.remove('watching-ad');
                actionBtn.classList.add('ad-failed');
                actionBtn.textContent = t('ad-failed-retry');
            });
        });
    }
    button.appendChild(actionBtn);
}
