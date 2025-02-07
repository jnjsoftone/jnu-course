import { By, until } from 'selenium-webdriver';
import { Cheer } from 'jnu-doc';
import { Chrome } from 'jnu-web';
import { loadJson, loadFile, saveJson, saveFile, sanitizeName, sleepAsync, PLATFORM } from 'jnu-abc';
import { goToUrl } from './utils/chrome';
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

/*
 * myclassIds 추가/업데이트
 * @param {string} url - 크롤링할 URL
 * @param {array} myclassIds - 이미 등록된 myclassIds
 * @returns {array} myclassIds - 추가/업데이트된 myclassIds
 */
const fetchMyclassIds = async (url: string = CLASS101_MYCLASSES_URL!, save = true) => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  console.log(`myclassIds.length: ${myclassIds.length}`);

  const chrome = await goToUrl(url, { scroll: true });
  await sleepAsync(2000);

  try {
    // 페이지 로딩 대기
    await chrome.driver.wait(until.elementLocated(By.css('ul[data-testid="grid-list"] > li')), 3000);
    // !! 오류: Error processing element 0: ReferenceError: until is not defined
    // await chrome.wait('ul[data-testid="grid-list"] > li', { until: 'located', timeout: 30000 });
    await sleepAsync(2000);
    const elements = await chrome.findElements('ul[data-testid="grid-list"] > li');
    const count = elements.length;
    console.log(`@@@count: ${count}`);

    for (let i = 0; i <= count; i++) {
      // 매 반복마다 요소들을 새로 찾기
      const elements = await chrome.findElements('ul[data-testid="grid-list"] > li');

      if (count <= myclassIds.length) {
        break;
      }

      console.log(`myclassIds length: ${myclassIds.length}`);
      console.log(`[${i}] 강의 처리 중...`);

      try {
        // 현재 요소 클릭
        await elements[i].click();
        await sleepAsync(5000);

        const currentUrl = await chrome.driver.getCurrentUrl();
        const classId = currentUrl.split('/')[5]; // 5번째 요소가 classId
        console.log(`classId By URL(${currentUrl}): ${classId}`);

        if (myclassIds.includes(classId)) {
          console.log(`이미 등록된 강좌입니다. ${classId}`);
        } else {
          console.log(`#### ${classId}: 새로운 강좌를 등록합니다.`);
          if (classId) {
            myclassIds.push(classId);
            if (save) saveJson(`${CLASS101_JSON_ROOT}/myclassIds.json`, myclassIds);
          }
        }

        // 뒤로 가기
        await chrome.driver.navigate().back();
        await chrome.driver.wait(until.urlContains('/my-classes'), 5000);
        await sleepAsync(3000);

        // 스크롤
        await chrome.getFullSize();
        await sleepAsync(2000);
      } catch (error) {
        console.error(`Error processing element ${i}:`, error);
        // 에러 발생시 다음 요소로 진행
        continue;
      }
    }

    return myclassIds;
  } finally {
    await chrome.close();
  }
};

/*
 * myclassIds -> myclasses 생성
 * @param {array} myclassIds - 강의 ID 목록
 * @param {boolean} save - 저장 여부
 * @returns {array} myclasses - 강의 목록
 */
const myclassesFromMyclassIds = (save = true) => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`) ?? [];

  myclassIds.forEach(async (classId) => {
    const products = loadJson(`${CLASS101_JSON_ROOT}/products.json`);
    const product = products.find((p) => p.klassId === classId);
    if (product) {
      const { title, productId, categoryId, authorId } = products.find((p) => p.klassId === classId);
      // myclasses에 classId가 없으면 추가 있으면 업데이트
      const index = myclasses.findIndex((c) => c.classId === classId);
      if (index === -1) {
        myclasses.push({ title, classId, productId, categoryId, authorId, step: '' });
      } else {
        // myclasses[index] = {title, classId, productId, categoryId, authorId, step: ''};
      }
    } else {
      console.log(`#### ${classId} 정보가 없습니다.`);
    }
  });

  if (save) saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
  return myclasses;
};

/*
 * 내 강의 목록 HTML 크롤링
 * @param {boolean} scroll - 스크롤 여부
 * @returns {string} html - 크롤링된 HTML
 */
const fetchMyClassesHtml = async (scroll = true) => {
  const url = `https://class101.net/ko/my-classes`;
  const chrome = await goToUrl(url, { scroll });
  const html = await chrome.getPageSource();

  await chrome.close();
  return html;
};

/*
 * 내 강의 목록 HTML 파싱
 * @param {string} html - 크롤링된 HTML
 * @returns {array} classes - 강의 목록
 */
const parseMyClassesHtml = (html) => {
  const cheer = new Cheer(html);
  const settings = [
    {
      key: 'title',
      selector: 'span[data-testid="body"].css-tay7br',
      callback: (text: string) => text.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim(),
    },
    {
      key: 'imageId',
      selector: 'img[data-testid="image-thumbnail-content"]',
      attribute: 'src',
      callback: (src: string) => src.split('/').pop()?.split('.')[0],
    },
    {
      key: 'chapter',
      selector: 'span[data-testid="body"].css-ndwbv2',
      callback: (text: string) => text.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim(),
    },
    {
      key: 'lastTime',
      selector: '.css-ep08pq',
      callback: (text: string) => text.trim(),
    },
  ];

  const $classes = cheer.find('ul[data-testid="grid-list"] > li');

  return cheer.jsons($classes, settings);
};

/*
 * myclasses -> myclassIds
 * @param {array} myclasses - 강의 목록
 * @param {boolean} save - 저장 여부
 * @returns {array} myclassIds - 강의 ID 목록
 */
const myclassIdsFromMyclasses = (save = false) => {
  const _myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  const myclassIds = _myclasses.map((c) => c.classId);
  if (save) saveJson(`${CLASS101_JSON_ROOT}/myclassIds.json`, myclassIds);
  return myclassIds;
};

/*
 * 중복 강의 ID 체크
 * @param {array} myclassIds - 강의 ID 목록
 * @returns {array} overlapClassIds - 중복 강의 ID 목록
 */
const checkOverlapMyclassIds = () => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const overlapIds = myclassIds.filter((id, index) => myclassIds.indexOf(id) !== index);
  return overlapIds;
};

/*
 * myclassIds와 myclasses 비교
 * @returns {object} { onlyMyclassIds, onlyMyclasses } - 어느 한쪽에만 있는 ID 목록
 */
const comparedMyclassIdsWithMyclasses = () => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const _myclassIds = myclassIdsFromMyclasses(loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`));

  const onlyMyclassIds = myclassIds.filter((id) => !_myclassIds.includes(id));
  const onlyMyclasses = _myclassIds.filter((id) => !myclassIds.includes(id));

  return {
    onlyMyclassIds,
    onlyMyclasses,
  };
};

// // * TEST
// const myclassIds = await fetchMyclassIds();
// console.log(`myclassIds.length: ${myclassIds.length}`);

// const myclasses = myclassesFromMyclassIds(myclassIds);
// console.log(`myclassIds.length: ${myclasses.length}`);

// const html = await fetchMyClassesHtml(true);
// saveFile(`${CLASS101_HTML_ROOT}/myclasses.html`, html);

// const overlapClassIds = checkOverlapMyclassIds();
// console.log(overlapClassIds);

// const onlys = comparedMyclassIdsWithMyclasses();
// console.log(JSON.stringify(onlys, null, 2));
