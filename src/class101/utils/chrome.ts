import { Chrome } from 'jnu-web';
import { loadJson, saveJson, sanitizeName, PLATFORM } from 'jnu-abc';
import dotenv from 'dotenv';
dotenv.config({ path: `../../../.env.${PLATFORM}` });

const { CHROME_DEFAULT_USER_EMAIL, CHROME_DEFAULT_USER_DATA_DIR } = process.env;

const goToUrl = async (
  url: string,
  {
    email = CHROME_DEFAULT_USER_EMAIL,
    userDataDir = CHROME_DEFAULT_USER_DATA_DIR,
    headless = false,
    scroll = false,
  } = {} // 빈 객체를 기본값으로 설정
) => {
  const chrome = new Chrome({
    headless: headless ? true : false,
    email,
    userDataDir,
    arguments: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080'],
  });

  try {
    await chrome.goto(url);
    if (scroll) await chrome.getFullSize();
    return chrome;
  } catch (error) {
    console.error('Chrome 초기화 중 오류 발생:', error);
    await chrome.close();
    throw error;
  }
};

export { goToUrl, Chrome };
