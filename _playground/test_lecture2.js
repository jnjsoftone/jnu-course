import { By, until } from 'selenium-webdriver';
import { Chrome } from 'jnu-web';
import { loadJson, loadFile, saveJson, saveFile, existsFile, sanitizeName, sleepAsync, PLATFORM } from 'jnu-abc';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
// import { spawn } from 'child_process';

dotenv.config({ path: `../.env.${PLATFORM}` });

const {
  CHROME_DEFAULT_USER_EMAIL,
  CHROME_DEFAULT_USER_DATA_DIR,
  CLASS101_HTML_ROOT,
  CLASS101_JSON_ROOT,
  CLASS101_MYCLASSES_URL,
} = process.env;

const CLASS101_PRODUCT_URL = 'https://class101.net/ko/products';

// &
const goToUrl = async (
  url,
  options = {
    email: CHROME_DEFAULT_USER_EMAIL,
    userDataDir: CHROME_DEFAULT_USER_DATA_DIR,
    headless: false,
    scroll: false,
  }
) => {
  const {
    email = CHROME_DEFAULT_USER_EMAIL,
    userDataDir = CHROME_DEFAULT_USER_DATA_DIR,
    headless = false,
    scroll = false,
  } = options;

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

/*
 * 강의 슬러그 추출
 * @param lecture: 강의 정보
 * @return slug: 강의 슬러그
 */
const getLectureSlug = (lecture) => {
  return `${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`;
};

/*
 * 강의 productId 추출
 * @param classId: 강의 번호
 * @return productId: 강의 productId
 */
const productIdFromClassId = (classId) => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  const classInfo = myclasses.find((c) => c.classId === classId) ?? { productId: '' };
  return classInfo.productId;
};

/*
 * 강의 시간 추출
 * @param durationText: 강의 시간 텍스트
 * @return duration: 강의 시간(초)
 */
const getDuration = (durationText) => {
  let duration = 0;
  if (durationText && durationText.includes(':')) {
    const parts = durationText.split(':');
    if (parts.length === 3) {
      // HH:MM:SS 형식
      const [hours, minutes, seconds] = parts.map(Number);
      duration = hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      // MM:SS 형식
      const [minutes, seconds] = parts.map(Number);
      duration = minutes * 60 + seconds;
    }
  }
  return duration;
};

/*
 * 강의 시간 텍스트 추출
 * @param duration: 강의 시간(초)
 * @return durationText: 강의 시간 텍스트
 */
const getDurationText = (duration) => {
  let durationText = '';
  if (duration >= 3600) {
    // 1시간 이상
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    durationText = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else if (duration >= 60) {
    // 1분 이상
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } else {
    // 1분 미만
    durationText = `0:${duration.toString().padStart(2, '0')}`;
  }
  return durationText;
};

// &----------------------------------
/*
 * 강의 product(home) 페이지 크롤링
 * @param classId: 강의 번호
 * @param save: 저장 여부
 * @return html: 크롤링 결과 HTML
 */
const fetchLectureHomeHtml = async (classId, save = true) => {
  const url = `${CLASS101_PRODUCT_URL}/${productIdFromClassId(classId)}`;
  const response = await fetch(url);
  const html = await response.text();
  if (save) {
    saveFile(`${CLASS101_HTML_ROOT}/classes/${classId}/home.html`, html, { newFile: false });
  }
  return html;
};

/*
 * 강의 목록 페이지 크롤링
 * @param classId: 강의 번호
 * @param save: 저장 여부
 * @return html: 크롤링 결과 HTML
 */
const fetchLectureIndexHtml = async (classId, save = true) => {
  const url = `https://class101.net/ko/classes/${classId}`;
  const chrome = await goToUrl(url);
  const html = await chrome.getPageSource();
  if (save) {
    saveFile(`${CLASS101_HTML_ROOT}/classes/${classId}/index.html`, html, { newFile: false });
  }
  return html;
};

// &----------------------------------
/*
 * 강의 정보 추출
 * @param html: 크롤링 결과 HTML
 * @param selectors: 선택자 목록
 * @return lectures: 강의 목록
 */
const extractLectures = (html, selectors = {}) => {
  selectors = {
    root: 'div.css-1o17esu',
    parent: '.css-zsoya5',
    chapter: 'div.css-194e0q9',
    chapterTitle: '.css-1gpjrk3',
    chapterName: '.css-12r95pg',
    lecture: 'button.css-1hvtp3b',
    lectureTitle: 'span.css-1h8wj8h',
    buttonRoot: 'button.css-1hvtp3b', // 'button.css-1hvtp3b'
    span1: 'css-1h8wj8h', // '.css-1h8wj8h'
    span2: '.css-q6203x', // '.css-q6203x'
    duration: 'svg[data-testid="playcircle-fill"]', // 'svg[data-testid="playcircle-fill"]'
    durationText: '.css-bgvpp3', //
    comment: 'svg[data-testid="reply-fill"]', // 'svg[data-testid="reply-fill"]'
    commentText: '.css-bgvpp3', //
    mission: '.css-19i4oqq', //
    attachment: '.css-12fz3yr', //
  };

  const $ = cheerio.load(html);
  const lectures = [];
  let lectureCount = 0;

  // 각 챕터 섹션 순회 (최상위 css-zsoya5만 선택)
  // div.css-194e0q9 => css-1o17esu
  // css-eazf6c -> css-1gpjrk3
  $(selectors.root)
    .parent(selectors.parent)
    .each((chapterIndex, element) => {
      console.log('found it');
      const $element = $(element);
      // 챕터 제목 확인
      const chapterTitle = $element.find(selectors.chapterTitle).first().text().trim();
      const chapterName = $element.find(selectors.chapterName).first().text().trim();

      // 챕터 정보 생성
      if (chapterTitle && chapterName) {
        const chapterPrefix = `${(chapterIndex + 1).toString().padStart(3, '0')}`;
        const chapterFullName = `${chapterPrefix}_${chapterName.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim()}`;

        // 강의 목록 컨테이너 찾기
        // const lecturesContainer = $element.find('div.css-zsoya5').first();
        const lecturesContainer = $element.find(selectors.parent).first();

        // 강의 정보 추출
        lecturesContainer.find(selectors.buttonRoot).each((_, button) => {
          const $button = $(button);
          lectureCount++;

          // 강의 제목 추출
          let lectureTitle = $button.find(selectors.span1).first().text().trim();
          lectureTitle = lectureTitle.replace(/(.+?)[\d\s]*:\d+.+/, '$1').trim();
          if (!lectureTitle) {
            lectureTitle = $button.find(selectors.span2).first().text().trim();
          }
          if (!lectureTitle) {
            lectureTitle = $button.text().split('\n')[0].trim();
          }

          // duration 추출
          let durationText = $button
            .find(selectors.duration)
            .parent()
            .find(selectors.durationText)
            .first()
            .text()
            .trim();

          let duration = getDuration(durationText);
          durationText = getDurationText(duration);

          // 댓글 수 추출
          let commentCount = 0;
          const commentEl = $button.find(selectors.comment).parent().find(selectors.commentText).first();

          if (commentEl.length) {
            commentCount = parseInt(commentEl.text().trim()) || 0;
          }

          // 미션 여부 확인
          const hasMission =
            $button.find(selectors.mission).filter((_, el) => $(el).text().includes('미션')).length > 0;

          // 첨부파일 여부 확인
          const hasAttachment =
            $button.find(selectors.attachment).filter((_, el) => $(el).text().includes('첨부파일')).length > 0;

          lectures.push({
            sn: lectureCount,
            chapter: chapterFullName,
            title: lectureTitle.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim(),
            duration,
            commentCount,
            hasMission,
            hasAttachment,
          });
        });
      }
    });

  return lectures;
};

/*
 * 다운로드 버튼 클릭
 * @param button: 다운로드 버튼
 * @param downloadDir: 다운로드 디렉토리
 * @param chrome: Chrome 객체
 * @return void
 */
const downloadByClick = async (button, downloadDir, chrome) => {
  try {
    console.log(`------------------------------------------ downloadByClick`);
    // 파일명 요소 찾기 (상위 요소에서 찾기)
    const parentElement = await button.findElement(By.xpath('ancestor::div[contains(@class, "css-pvbmuo")]'));
    const fileNameElement = await parentElement.findElement(By.css('p.css-1e3x3i0'));
    const fileName = await fileNameElement.getText();
    // !! .py 파일인 경우 스킵
    if (fileName.toLowerCase().endsWith('.py')) {
      console.log(`#######################################Python 파일 스킵: ${fileName}`);
      return;
    }
    // 다운로드 디렉토리 생성
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, {
        recursive: true,
      });
    }
    // 시스템 다운로드 폴더 경로
    const downloadPath = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');
    // 다운로드 전 파일 목록 저장
    const beforeFiles = fs.readdirSync(downloadPath);
    // 버튼 클릭
    await button.click();
    await sleepAsync(2000);
    // 다운로드 완료 대기
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            clearInterval(checkDownload);
            reject(new Error('다운로드 시간 초과'));
          }, 30000);
          const checkDownload = setInterval(() => {
            const afterFiles = fs.readdirSync(downloadPath);
            const newFiles = afterFiles.filter((file) => !beforeFiles.includes(file));
            if (newFiles.length > 0) {
              const isCompleted = !newFiles.some((file) => file.endsWith('.crdownload') || file.endsWith('.tmp'));
              if (isCompleted) {
                // 새로 다운로드된 파일을 지정된 디렉토리로 이동
                for (const file of newFiles) {
                  const srcPath = path.join(downloadPath, file);
                  const destPath = path.join(downloadDir, file);
                  fs.renameSync(srcPath, destPath);
                }
                clearTimeout(timeout);
                clearInterval(checkDownload);
                resolve(true);
              }
            }
          }, 500);
        });
        break;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) throw error;
        await sleepAsync(2000);
      }
    }
    console.log(`다운로드 완료: ${downloadDir}`);
    await sleepAsync(2000);
  } catch (error) {
    console.error(`다운로드 실패 (${downloadDir}):`, error);
    // 에러 로그 저장을 위한 디렉토리 생성
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, {
        recursive: true,
      });
    }
    fs.writeFileSync(path.join(downloadDir, 'error.html'), `error: ${downloadDir}`, 'utf8');
  }
};

/**
 * 강의 자료 다운로드
 * @param lecture: 강의 정보
 * @param lectureDir: 강의 디렉토리
 * @param chrome: Chrome 객체
 * @return void
 */
const getMaterial = async (lecture, lectureDir, chrome) => {
  console.log(`#수업자료 처리 중: ${lecture.title} ${lecture.lectureId}`);
  try {
    // 수업자료 탭이 있는지 확인
    const materialSpan = await chrome.driver.findElement(By.xpath(`//span[text()="수업자료"]`));
    // 수업자료 탭 클릭
    await materialSpan.click();
    await sleepAsync(5000);
    // 자료 내용 저장
    // const materialContent = await chrome.getElementHtml('div.css-1przxg');
    // const materialContent = await chrome.getElementHtml('div.css-zqgvt1');
    // const materialPath = `${lectureDir}/materials/index.html`;
    // saveFile(materialPath, materialContent, {
    //   newFile: false,
    // });
    // 첨부파일이 있는 경우 다운로드
    if (lecture.hasAttachment) {
      const filesDir = `${lectureDir}/files`;
      const downloadButtons = await chrome.driver.findElements(By.xpath(`//p[text()="Download"]`));
      for (const button of downloadButtons) {
        await downloadByClick(button, filesDir, chrome);
        await sleepAsync(20000);
      }
    }
    // 커리큘럼 탭으로 돌아가기
    const curriculumSpan = await chrome.driver.findElement(By.xpath(`//span[text()="커리큘럼"]`));
    await curriculumSpan.click();
    await sleepAsync(3000);
  } catch (error) {
    console.error(`수업자료 처리 중 오류 발생:`, error);
    throw error;
  }
};

/*
 * 강의 정보 추출 및 수업자료 다운로드
 * @param type: 'init' or 'update'
 * @param lectureSns: 수집할 강의 번호 목록, []인 경우 전체 수집
 */
const redownFiles = async (classId) => {
  let chrome = null;
  let lectureIds = [];
  const url = `https://class101.net/ko/classes/${classId}`;
  chrome = await goToUrl(url);
  await sleepAsync(30000);
  const html = await chrome.getPageSource();
  let lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);

  for (const lecture of lectures) {
    if (!lecture.hasAttachment) {
      continue;
    }
    const lectureDir = `${CLASS101_HTML_ROOT}/classes/${classId}/${lecture.sn.toString().padStart(3, '0')}_${
      lecture.lectureId
    }`;
    const errorHtml = `${lectureDir}/files/error.html`;
    if (existsFile(errorHtml)) {
      fs.rename(errorHtml, errorHtml.replace('error.html', '_error.html'), (err) => console.log(err));
    }
    console.log(`${classId}:: ${lecture.title} (${lecture.sn}번째 파일 처리 중)`);

    try {
      // * 강의 버튼 클릭
      // const xpath_ = `//button[contains(@class, "css-1hvtp3b")][.//span[contains(@class, "css-1h8wj8h")]]`;
      const xpath_ = `//button[@class="css-1hvtp3b"][.//span[@class="css-1h8wj8h" or @class="css-9a1m73"]]`;
      // css-9a1m73

      const titleButtons = await chrome.driver.findElements(By.xpath(xpath_));
      let button = titleButtons[lecture.sn - 1];

      if (!button) {
        console.error(`강의 버튼을 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
        continue;
      }
      await button.click();
      await sleepAsync(5000);
      // * 수업자료 추출
      await getMaterial(lecture, lectureDir, chrome);
    } catch (error) {
      // 타입 명시
      console.error(`강의 처리 중 오류 발생 (${lecture.title}):`, error);
      // 브라우저가 닫혔다면 다시 열기
      if (error.name === 'NoSuchWindowError') {
        if (chrome) {
          await chrome.close();
        }
        chrome = await goToUrl(url);
        await sleepAsync(3000);
      }
      continue;
    }
  }

  if (chrome) {
    await chrome.close();
  }
};

// # main functions
// /*
//  * 강의 정보 추출 및 수업자료 다운로드
//  * @param myclasses: 강의 목록
//  *  [{title, classId, productId, categoryId, authorId}, ...]
//  * @param type: 'init' or 'update'
//  * @return void
//  */
// const processClasses = async (myclasses = [], type = 'init') => {
//   if (myclasses.length === 0) {
//     myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
//   }
//   // lectureSns = []

//   for (const myclass of myclasses) {
//     console.log(`Processing class ${myclass.classId}`);
//     try {
//       await redownFiles(myclass.classId, type);
//       await sleepAsync(5000);
//     } catch (error) {
//       console.error(`Error processing class ${myclass.classId}:`, error);
//       continue;
//     }
//   }
// };

// * TEST
// const classId = '5ec0d03c31a0232781e26854';
// await fetchLectureHomeHtml(classId);

// await processClasses();
// const classIds = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`).map((c) => c.classId);
// for (const classId of classIds) {
//   await redownFiles(classId);
// }
// await redownFiles('5ec0d03c31a0232781e26854');

const substituteTitle = (title) => {
  let result = title.includes(':')
    ? title
        .split(':')[0]
        .trim()
        .replace(/(.+?)[\d]+$/, '$1')
    : title;

  result = result
    .replace(/미션첨부파일$/, '')
    .replace(/첨부파일$/, '')
    .replace(/미션$/, '');

  return result;
};

// console.log(substituteTitle('수업자료 내려받기05:003첨부파일'));
// console.log(substituteTitle('수업자료5:03첨부파일'));

const classIds = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`).map((c) => c.classId);
for (const classId of classIds) {
  const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  for (const lecture of lectures) {
    lecture.title = substituteTitle(lecture.title);
  }
  await saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
}
