import { Chrome } from 'jnu-web';
import { loadJson, loadFile, saveJson, saveFile, sleepAsync, sanitizeName, PLATFORM } from 'jnu-abc';
import dotenv from 'dotenv';
dotenv.config({ path: `../.env.${PLATFORM}` });

const {
  CHROME_DEFAULT_USER_EMAIL,
  CHROME_DEFAULT_USER_DATA_DIR,
  CLASS101_HTML_ROOT,
  CLASS101_JSON_ROOT,
  CLASS101_MYCLASSES_URL,
} = process.env;

// CLASS101_MYCLASS_URL="https://class101.net/ko/my-classes"

const goToUrl = async (
  url,
  { email = CHROME_DEFAULT_USER_EMAIL, userDataDir = CHROME_DEFAULT_USER_DATA_DIR, headless = false, scroll = false }
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

// * TEST

const chrome = await goToUrl(CLASS101_MYCLASSES_URL, { scroll: true });
await sleepAsync(2000);
console.log('### fetchMyclassIds 2');

try {
  // 페이지 로딩 대기
  // await chrome.driver.wait(until.elementLocated(By.css('ul[data-testid="grid-list"] > li')), 3000);
  await chrome.wait('ul[data-testid="grid-list"] > li');
  await sleepAsync(2000);
  const elements = await chrome.findElements('ul[data-testid="grid-list"] > li');
  const count = elements.length;
  console.log(`count: ${count}`);

  // for (let i = 0; i <= count; i++) {
  //   // 매 반복마다 요소들을 새로 찾기
  //   const elements = await chrome.findElements('ul[data-testid="grid-list"] > li');

  //   if (count <= myclassIds.length) {
  //     break;
  //   }

  //   console.log(`myclassIds length: ${myclassIds.length}`);
  //   console.log(`[${i}] 강의 처리 중...`);
  // }
} catch (error) {
  console.error(error);
}

chrome.close();
