import fs from 'fs';
import { By, until } from 'selenium-webdriver';
import { sleepAsync, existsFile, saveFile, loadFile, findFolders, loadJson, saveJson, Chrome } from 'jnj-utils';
import * as cheerio from 'cheerio';
import {
  CHROME_DEFAULT_USER_EMAIL,
  CHROME_DEFAULT_USER_DATA_DIR,
  CLASS101_JSON_ROOT,
  CLASS101_HTML_ROOT,
  CLASS101_VIDEO_ROOT,
} from './__env.js';
import axios from 'axios';
import path from 'path';
import { spawn } from 'child_process';
// # constants
const URL_CATEGORIES = 'https://class101.net/ko/categories';
const CATEGORIES_JSON_PATH = `${CLASS101_JSON_ROOT}/categories.json`;
// * chrome goto url
// ** Sub Functions
// * 페이지 이동 함수
const goToUrl = async (
  url,
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
// html에서 __NEXT_DATA__ 내용 -> json 파싱
const parseNextData = (html) => {
  try {
    const $ = cheerio.load(html);
    const nextDataScript = $('#__NEXT_DATA__');
    if (!nextDataScript.length) {
      throw new Error('__NEXT_DATA__ 스크립트를 찾을 수 없습니다.');
    }
    // JSON 파싱
    return JSON.parse(nextDataScript.html());
  } catch (error) {
    console.error('에러 발생:', error);
    throw error;
  }
};
// html에서 __NEXT_DATA__ 내용 -> json 파싱 후 저장
const saveNextData = (name, html) => {
  const json = parseNextData(html);
  saveJson(`${CLASS101_JSON_ROOT}/${name}.json`, json);
  return json;
};
// nextData에서 카테고리 정보 추출
const jsonFromNextData = async (nextData) => {
  const data = nextData.props.apolloState.data;
  const data_ = [];
  Object.values(data).forEach((item) => {
    if (item.__typename === 'CategoryV2' && item.depth === 0) {
      const categoryId0 = item.id;
      const title0 = item.title;
      // 하위 카테고리 처리
      item.children.forEach((childRef) => {
        const childId = childRef.__ref.split(':')[1];
        const childCategory = data[`CategoryV2:${childId}`];
        data_.push({
          categoryId0,
          title0,
          categoryId: childCategory.id,
          title: childCategory.title,
        });
      });
    }
  });
  return data_;
};
// * 메인 카테고리 저장
const saveMainCategories = async () => {
  const chrome = await goToUrl(URL_CATEGORIES);
  // TODO: wait for element, * wait 2 seconds,
  await sleepAsync(3000);
  const nextData = saveNextData('categories_nextData', await chrome.getPageSource());
  const json = await jsonFromNextData(nextData);
  saveJson(CATEGORIES_JSON_PATH, json);
  return json;
};
// * 부카테고리
const extractSubCategories = (nextData, ancestorId) => {
  const data = nextData.props.apolloState.data;
  let subCategories = [];
  // 데이터 추출
  Object.entries(data).forEach(([key, value]) => {
    if (key.startsWith('CategoryV2:')) {
      const categoryId = value.id;
      const title = value.title;
      subCategories.push({
        ancestorId,
        categoryId,
        title,
      });
    }
  });
  return subCategories.length > 1 ? subCategories.slice(1) : subCategories; // 첫번째 요소(전체) 제거
};
const fetchSubCategories = async (categoryId) => {
  const url = `https://class101.net/ko/categories/${categoryId}`;
  const chrome = await goToUrl(url);
  // const nextData = parseNextData(await chrome.getPageSource());
  const nextData = saveNextData(`nextData/categories/${categoryId}`, await chrome.getPageSource());
  const subCategories = await extractSubCategories(nextData, categoryId);
  await chrome.close();
  return subCategories;
};
const saveAllSubCategories = async () => {
  const categories = loadJson(`${CLASS101_JSON_ROOT}/categories.json`);
  let subCategories = [];
  // let chrome;
  for (const category of categories) {
    if (existsFile(`${CLASS101_JSON_ROOT}/nextData/categories/${category.categoryId}.json`)) {
      continue;
    }
    const url = `https://class101.net/ko/categories/${category.categoryId}`;
    const chrome = await goToUrl(url);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const nextData = saveNextData(`nextData/categories/${category.categoryId}`, await chrome.getPageSource());
    console.log(`subCategories: ${category.title}`);
    subCategories = [...subCategories, ...(await extractSubCategories(nextData, category.categoryId))];
  }
  // await chrome.close();
  saveJson(`${CLASS101_JSON_ROOT}/subCategories.json`, subCategories);
  return subCategories;
};
// ** products
const fetchCategoryProducts = async (categoryId, cursor = null) => {
  const response = await fetch('https://cdn-production-gateway.class101.net/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operationName: 'CategoryProductsV3OnCategoryProductList',
      variables: {
        filter: {
          purchaseOptions: ['Lifetime', 'Rental', 'Subscription'],
        },
        categoryId,
        first: 1000,
        isLoggedIn: true,
        sort: 'Popular',
        originalLanguages: [],
        after: cursor || undefined,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: 'de9123f7372649c2874c9939436d6c5417a48b55af12045b7bdaea7de0a079cc',
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};
const fetchProducts = async () => {
  const subCategories = loadJson(`${CLASS101_JSON_ROOT}/subCategories.json`);
  let products = [];
  for (const subCategory of subCategories) {
    const response = await fetchCategoryProducts(subCategory.categoryId);
    await sleepAsync(3000);
    if (
      !response ||
      !response.data ||
      !response.data.categoryProductsV3 ||
      response.data.categoryProductsV3.edges.length === 0
    ) {
      console.log(`No products in ${subCategory.title} ${subCategory.categoryId}`);
      continue;
    }
    response.data.categoryProductsV3.edges.map((edge) => {
      const node = edge.node;
      let _imageId = '';
      try {
        _imageId = node.coverImageUrl.split('/').pop().split('.')[0];
      } catch (error) {
        console.log(`No imageId: ${node.title}, ${node._id}`);
      }
      const [
        productId,
        title,
        imageId,
        klassId,
        likedCount,
        firestoreId,
        categoryId,
        categoryTitle,
        authorId,
        authorName,
      ] = [
        node._id,
        node.title,
        _imageId,
        node.klassId,
        node.likedCount,
        node.firestoreId,
        node.category.id,
        node.category.title,
        node.author._id,
        node.author.displayName,
      ];
      const product = {
        productId,
        title,
        imageId,
        klassId,
        likedCount,
        firestoreId,
        categoryId,
        categoryTitle,
        authorId,
        authorName,
      };
      // productId가 중복되면 push하지 않도록
      if (!products.find((p) => p.productId === product.productId)) {
        products.push(product);
      }
      saveJson(`${CLASS101_JSON_ROOT}/products.json`, products);
    });
  }
  return products;
};
// ** my-classes
const fetchMyClassesHtml = async () => {
  const url = `https://class101.net/ko/my-classes`;
  const chrome = await goToUrl(url, {
    scroll: true,
  });
  const html = await chrome.getPageSource();
  await chrome.close();
  return html;
};
const parseMyClassesHtml = (html) => {
  const $ = cheerio.load(html);
  const classes = [];
  // 강의 목록 찾기
  $('ul[data-testid="grid-list"] > li').each((_, element) => {
    const li = $(element);
    // 커버 이미지
    const coverImage = li.find('img[data-testid="image-thumbnail-content"]').attr('src');
    // 챕터와 제목
    const chapter = li.find('span[data-testid="body"].css-ndwbv2').text();
    const title = li.find('span[data-testid="body"].css-tay7br').text();
    // 재생 시간 (있는 경우)
    const lastTime = li.find('.css-ep08pq').text() || '';
    // https://cdn.class101.net/images/
    classes.push({
      title: title.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim(),
      imageId: coverImage?.split('/').pop()?.split('.')[0],
      chapter: chapter.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim(),
      lastTime: lastTime.trim(),
    });
  });
  return classes;
};
// *
const getMyClassIds = () => {
  return loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`).map((c) => c.classId);
};
const _convMyClassIds = () => {
  saveJson(`${CLASS101_JSON_ROOT}/myclassIds.json`, getMyClassIds());
};
// * myclassIds 저장
const saveMyclassIds = async () => {
  console.log('@@@ saveMyclassIds1');
  let myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const url = 'https://class101.net/ko/my-classes';
  const chrome = await goToUrl(url, {
    scroll: true,
  });
  await sleepAsync(2000);
  console.log('### saveMyclassIds 2');
  try {
    // 페이지 로딩 대기
    await chrome.driver.wait(until.elementLocated(By.css('ul[data-testid="grid-list"] > li')), 3000);
    await sleepAsync(2000);
    const elements = await chrome.findElements('ul[data-testid="grid-list"] > li');
    const count = elements.length;
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
          myclassIds.push(classId);
          saveJson(`${CLASS101_JSON_ROOT}/myclassIds.json`, myclassIds);
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
        continue;
      }
    }
    return myclassIds;
  } finally {
    await chrome.close();
  }
};
// * myclassIds -> myclasses 생성
const saveMyclassIdsFromMyclassIds = () => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const myclasses = existsFile(`${CLASS101_JSON_ROOT}/myclasses.json`)
    ? loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`)
    : [];
  myclassIds.forEach(async (classId) => {
    const products = loadJson(`${CLASS101_JSON_ROOT}/products.json`);
    const product = products.find((p) => p.klassId === classId);
    if (product) {
      const { title, productId, categoryId, authorId } = products.find((p) => p.klassId === classId);
      // myclasses에 classId가 없으면 추가 있으면 업데이트
      const index = myclasses.findIndex((c) => c.classId === classId);
      if (index === -1) {
        myclasses.push({
          title,
          classId,
          productId,
          categoryId,
          authorId,
          step: '',
        });
      } else {
        // myclasses[index] = {title, classId, productId, categoryId, authorId, step: ''};
      }
    } else {
      console.log(`#### ${classId} 정보가 없습니다.`);
    }
  });
  saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
};
// # lectures
const getLectureSlug = (lecture) => {
  return `${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`;
};
const getLectureHtml = async (classId) => {
  const url = `https://class101.net/ko/classes/${classId}`;
  const chrome = await goToUrl(url);
  const html = await chrome.getPageSource();
  return html;
};
// const extractLectures = (html, sns=[])=>{
const extractLectures = (html) => {
  const $ = cheerio.load(html);
  const lectures = [];
  let lectureCount = 0;
  // console.log(`@@@ extractLectures sns: ${sns}`);
  // 각 챕터 섹션 순회 (최상위 css-zsoya5만 선택)
  $('div.css-1o17esu')
    .parent('.css-zsoya5')
    .each((chapterIndex, element) => {
      console.log(`!!!!!!!extract: ${chapterIndex + 1}`);
      const $element = $(element);
      // 챕터 제목 확인
      const chapterTitle = $element.find('.css-1gpjrk3').first().text().trim();
      const chapterName = $element.find('.css-12r95pg').first().text().trim();
      // 챕터 정보 생성
      if (chapterTitle && chapterName) {
        const chapterPrefix = `${(chapterIndex + 1).toString().padStart(3, '0')}`;
        const chapterFullName = `${chapterPrefix}_${chapterName.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ').trim()}`;
        // 강의 목록 컨테이너 찾기
        const lecturesContainer = $element.find('div.css-zsoya5').first();
        // 강의 정보 추출
        lecturesContainer.find('button.css-1hvtp3b').each((_, button) => {
          const $button = $(button);
          lectureCount++;
          // 강의 제목 추출
          let lectureTitle = $button.find('.css-1h8wj8h').first().text().trim();
          if (!lectureTitle) {
            lectureTitle = $button.find('.css-q6203x').first().text().trim();
          }
          if (!lectureTitle) {
            lectureTitle = $button.text().split('\n')[0].trim();
          }
          // duration 추출
          let duration = 0;
          const durationEl = $button.find('svg[data-testid="playcircle-fill"]').parent().find('.css-bgvpp3').first();
          if (durationEl.length) {
            const durationText = durationEl.text().trim();
            if (durationText && durationText.includes(':')) {
              const parts = durationText.split(':');
              if (parts.length === 3) {
                const [hours, minutes, seconds] = parts.map(Number);
                duration = hours * 3600 + minutes * 60 + seconds;
              } else if (parts.length === 2) {
                const [minutes, seconds] = parts.map(Number);
                duration = minutes * 60 + seconds;
              }
            }
          }
          // duration이 600초(10분) 이상인 경우 시간 형식으로 표시
          let durationText = '';
          if (duration >= 3600) {
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            const seconds = duration % 60;
            durationText = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          } else if (duration >= 60) {
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          } else {
            durationText = `0:${duration.toString().padStart(2, '0')}`;
          }
          // 댓글 수 추출
          let commentCount = 0;
          const commentEl = $button.find('svg[data-testid="reply-fill"]').parent().find('.css-bgvpp3').first();
          if (commentEl.length) {
            commentCount = parseInt(commentEl.text().trim()) || 0;
          }
          // 미션 여부 확인
          const hasMission = $button.find('.css-19i4oqq').filter((_, el) => $(el).text().includes('미션')).length > 0;
          // 첨부파일 여부 확인
          const hasAttachment =
            $button.find('.css-12fz3yr').filter((_, el) => $(el).text().includes('첨부파일')).length > 0;
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
// * 다시 다운로드할 강의 목록 저장(material, subtitles 없는 강의)
const saveRedownLectures = () => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const redownLectures = [];
  for (const classId of myclassIds) {
    const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
    for (const lecture of lectures) {
      if ('subtitles' in lecture && lecture.subtitles.length > 0) {
        continue;
      }
      // const { title, sn, lectureId } = lecture;
      // redownLectures.push({ classId, title, sn, lectureId });
      redownLectures.push({
        classId,
        ...lecture,
      });
    }
  }
  saveJson(`${CLASS101_JSON_ROOT}/redownLectures.json`, redownLectures);
};
// 강의 정보 추출 및 수업자료 다운로드
// type: 'init' or 'update'
const saveClassLectures = async (classId, type = 'init', lectureSns = []) => {
  let chrome = null;
  let lectureIds = [];
  try {
    const url = `https://class101.net/ko/classes/${classId}`;
    chrome = await goToUrl(url);
    await sleepAsync(3000);
    const html = await chrome.getPageSource();
    let lectures = [];
    if (type === 'update') {
      lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
    } else {
      console.log(`#### 강의 정보 수집중(init): ${classId}`);
      // lectures = [];
      saveFile(`${CLASS101_HTML_ROOT}/classes/${classId}/index.html`, html, {
        newFile: false,
      });
      lectures = extractLectures(html);
    }
    for (const lecture of lectures) {
      if (lectureSns.length > 0 && !lectureSns.includes(lecture.sn)) {
        continue;
      }
      // if ('subtitles' in lecture && lecture.subtitles.length > 0) {
      //     continue;
      // }
      try {
        // * 강의 버튼 클릭
        // 제목으로 버튼 찾기 (따옴표 처리)
        const escapedTitle = lecture.title.replace(/"/g, "', '\"', '");
        console.log(`escapedTitle: ${escapedTitle}`);
        // if (lecture.sn === 1) {
        //   console.log(`!!!강의 버튼 클릭 스킵: ${lecture.title} (${lecture.sn}번째)`);
        //   continue;
        // }
        console.log(`####강의 정보 수집중: ${lecture.title} (${lecture.sn}번째)`);
        // const xpath_ = `//button[contains(@class, "css-1hvtp3b")][.//span[contains(@class, "css-1h8wj8h")]]`;
        const xpath_ = `//button[@class="css-1hvtp3b"][.//span[@class="css-1h8wj8h" or @class="css-9a1m73"]]`;
        // css-9a1m73

        const titleButtons = await chrome.driver.findElements(By.xpath(xpath_));
        let button = titleButtons[lecture.sn - 1];
        // const buttonText = await button.getText();
        // if (!buttonText.includes(lecture.title)) {
        //   button = titleButtons[lecture.sn - 2];
        // }
        // console.log(`버튼 텍스트: ${buttonText} : ${lecture.title}`);
        if (!button) {
          console.error(`강의 버튼을 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
          continue;
        }
        await button.click();
        // const videoCss = 'div#vjs_video_3 > video';
        const videoCss = 'video';
        // await chrome.waitForElementVisible('div#vjs_video_3 > video');
        try {
          await chrome.driver.wait(until.elementLocated(By.css(videoCss)), 30000);
        } catch (error) {
          console.error(`강의 비디오를 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
          // continue;
        }
        await sleepAsync(5000);
        // * lectureId 추출
        const url_ = await chrome.driver.getCurrentUrl();
        const lectureId = url_.split('/')[7];
        if (!lectureIds.includes(lectureId)) {
          lectureIds.push(lectureId);
        } else {
          console.log(`@@@@ 이미 처리된 강의입니다: ${lecture.title} (${lecture.sn}번째)`);
        }
        console.log(`lecture.title: ${lecture.title}, lectureId: ${lectureId}`);
        lecture.lectureId = lectureId;
        // * video division html 저장
        const lectureDir = `${CLASS101_HTML_ROOT}/classes/${classId}/${lecture.sn.toString().padStart(3, '0')}_${
          lecture.lectureId
        }`;
        const html = await chrome.getElementHtml(videoCss);
        saveFile(`${lectureDir}/video.html`, html, {
          newFile: false,
        });
        // * 수업자료 추출
        await getMaterial(lecture, lectureDir, chrome);
        // 현재 진행상황 저장
        saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
        // * 자막 다운로드(추가)
        await downloadLectureSubtitles(classId, lectureId);
        // !! 자막 정보 저장 추가
        const vttInfos = await downloadVttFiles(html, `${lectureDir}/subtitles`);
        lecture.subtitles = vttInfos;
        saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
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
    // 최종 결과 저장
    // saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
  } catch (error) {
    console.error('전체 처리 중 오류 발생:', error);
    throw error;
  } finally {
    if (chrome) {
      await chrome.close();
    }
  }
};
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
 */ const getMaterial = async (lecture, lectureDir, chrome) => {
  console.log(`#수업자료 처리 중: ${lecture.title} ${lecture.lectureId}`);
  try {
    // 수업자료 탭이 있는지 확인
    const materialSpan = await chrome.driver.findElement(By.xpath(`//span[text()="수업자료"]`));
    // 수업자료 탭 클릭
    await materialSpan.click();
    await sleepAsync(5000);
    // 자료 내용 저장
    const materialContent = await chrome.getElementHtml('div.css-1przxg');
    // const materialContent = await chrome.getElementHtml('div.css-zqgvt1');
    const materialPath = `${lectureDir}/materials/index.html`;
    saveFile(materialPath, materialContent, {
      newFile: false,
    });
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
const downloadVttFiles = async (htmlContent, outputDir = 'subtitles') => {
  // const downloadVttFiles = async (htmlContent, outputDir = 'files/subtitles')=>{
  // HTML 파싱
  const $ = cheerio.load(htmlContent);
  // track 태그에서 VTT 파일 URL 추출
  const trackElements = $('track');
  const vttInfos = [];
  for (let i = 0; i < trackElements.length; i++) {
    const track = trackElements[i];
    // src 속성이 있고 .vtt로 끝나는 경우만 처리
    const src = $(track).attr('src');
    const lang = $(track).attr('srclang') || 'unknown';
    if (src && src.endsWith('.vtt')) {
      try {
        // VTT 파일 다운로드
        const response = await axios({
          method: 'get',
          url: src,
          responseType: 'arraybuffer',
        });
        // 파일명 추출 (URL의 마지막 분)
        const filename = src.split('/').pop();
        // 파일 저장
        saveFile(path.join(outputDir, filename), response.data, {
          newFile: false,
        });
        console.log(`다운로드 완료: ${outputDir}/${filename}`);
        // VTT 정보 저장
        vttInfos.push({
          lang,
          name: filename,
        });
      } catch (error) {
        if (error instanceof Error) {
          console.error(`다운로드 실패 (${src}): ${error.message}`);
        } else {
          console.error(`다로드 실패 (${src}): 알 수 없는 오류`);
        }
      }
    }
  }
  return vttInfos;
};
// 편의 함수: HTML 파일에서 VTT 다운로드
const downloadLectureSubtitles = async (classId, lectureId) => {
  const classInfo = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  try {
    const lecture = classInfo.find((l) => l.lectureId === lectureId);
    const lectureSlug = getLectureSlug(lecture);
    const lectureDir = `${CLASS101_HTML_ROOT}/classes/${classId}/${lectureSlug}`;
    const lectureHtmlPath = `${lectureDir}/video.html`;
    const htmlContent = loadFile(lectureHtmlPath);
    const vttInfos = await downloadVttFiles(htmlContent, `${lectureDir}/subtitles`);
    lecture.subtitles = vttInfos;
    console.log('다운로드된 자막 정보:', vttInfos);
    // VTT 정보 저장
    saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, classInfo);
    // saveJson(`${lectureDir}/subtitles/info.json`, vttInfos);
    return vttInfos;
  } catch (error) {
    console.error('VTT 파일 다운로드 중 오류 발생:', error);
    return [];
  }
};
// # video
const downloadVideo = async (classId, lectureId) => {
  try {
    const classInfo = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
    const lecture = classInfo.find((l) => l.lectureId === lectureId);
    // Python 스크립트 실행
    const pythonProcess = spawn('python', [
      'BE/class101/python/recorder.py',
      '--url',
      `https://class101.net/ko/classes/${classId}/lectures/${lectureId}`,
      '--duration',
      '300',
    ]);
    // Python 프로세스의 출력 처리
    pythonProcess.stdout.on('data', (data) => {
      console.log(`Python Output: ${data}`);
    });
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
    });
    // 프로세스 종료 대기
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error('비디오 다운로드 중 오류 발생:', error);
    throw error;
  }
};
// # main functions
// step: 'L': 강의 정보 추출 완료, 'M': 강의 자료 다운로드 완료, 'V': 비디오 다운로드 완료, 'S': 자막 다운로드 완료
const processClasses = async (redownLectures) => {
  // const overlappedLectures = loadJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`);

  // const redownLectures = overlappedLectures.filter((_, index) => index % 2 === 1);
  for (const c of redownLectures) {
    try {
      console.log(`강의 정보 추출 중: ${c.classId}`);
      await saveClassLectures(c.classId);
      // 원본 myclasses에서 해당 class를 찾아 업데이트
      const targetClass = myclasses.find((mc) => mc.classId === c.classId);
      if (targetClass) {
        targetClass.step += 'L';
        saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
      }
      await sleepAsync(5000);
    } catch (error) {
      console.error(`Error processing class ${c.classId}:`, error);
      continue;
    }
  }
};
export {
  saveMainCategories,
  saveAllSubCategories,
  fetchProducts,
  saveMyclassIds,
  saveMyclassIdsFromMyclassIds,
  saveClassLectures,
  downloadLectureSubtitles,
  processClasses,
};
// console.log(findFolders(`${CLASS101_HTML_ROOT}/classes/5c514d81d30c532c446947ba`));
// const classId = '5c514d81d30c532c446947ba';
// * Class Json에 Html Download 반영
const vttInfoFromHtml = async (htmlContent) => {
  // HTML 파싱
  const $ = cheerio.load(htmlContent);
  const trackElements = $('track');
  const vttInfos = [];
  for (let i = 0; i < trackElements.length; i++) {
    const track = trackElements[i];
    // src 속성이 있고 .vtt로 끝나는 경우만 처리
    const src = $(track).attr('src');
    const lang = $(track).attr('srclang') || 'unknown';
    if (src && src.endsWith('.vtt')) {
      // 파일명 추출 (URL의 마지막 분)
      const filename = src.split('/').pop();
      vttInfos.push({
        lang,
        name: filename,
      });
    }
  }
  return vttInfos;
};
const classJsonFromHtml = async (classId) => {
  const classHtmlDirs = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
  // '/Users/moon/JnJ-soft/Projects/internal/@jnjsoft/jnj-learn/_repo/class101/html/classes/5c514d81d30c532c446947ba/029_5c7d26a535b52893ce6829f9'
  // const classJsonDir = findFolders(`${CLASS101_JSON_ROOT}/classes/${classId}`);
  const infos = [];
  for (const classHtmlDir of classHtmlDirs) {
    const lectureSn = classHtmlDir.split('/').pop();
    const [snStr, lectureId] = lectureSn.split('_');
    const sn = parseInt(snStr);
    const videoPath = `${classHtmlDir}/video.html`;
    if (!fs.existsSync(videoPath)) {
      continue;
    }
    const htmlContent = loadFile(videoPath);
    const subtitles = await vttInfoFromHtml(htmlContent);
    if (subtitles.length > 0) {
      const subtitlePath = `${classHtmlDir}/subtitles`;
      if (!fs.existsSync(subtitlePath)) {
        console.log(`${classId} 자막 파일 없음: ${subtitlePath}`);
      }
      // console.log(subtitles);
    }
    const lectureInfo = {
      sn,
      lectureId,
      subtitles,
    };
    // console.log(lectureInfo);
    infos.push(lectureInfo);
  }
  saveJson(`${CLASS101_JSON_ROOT}/_classes/${classId}.json`, infos);
  // const classJsonPath = classJsonDir[0];
  // const classJson = loadJson(classJsonPath);
  // return classJson;
};
// # update class json(_classes -> classes)
const updateClassJson = async (classId) => {
  const classJson = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  const classJson_ = loadJson(`${CLASS101_JSON_ROOT}/_classes/${classId}.json`);
  for (const l of classJson_) {
    const targetLecture = classJson.find((c) => c.sn === l.sn);
    if (targetLecture) {
      targetLecture.lectureId = l.lectureId;
      targetLecture.subtitles = l.subtitles;
    }
  }
  saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, classJson);
};
const updateClassJsonAll = async () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    await classJsonFromHtml(c.classId);
    await updateClassJson(c.classId);
  }
};
// 다운로드 보완:classId, lectureId
// downloadLectureSubtitles(classId, lectureId);
// // const classId = '60c705a4e4f358000d671380';
// const classId = '62d3a069072c35000e15c21a';
// // const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
// // console.log(lectures);
// saveClassLectures(classId, 'update');
// const classId = '600813bfea24bb000dd0406d';
// classJsonFromHtml('600813bfea24bb000dd0406d');
// updateClassJson('600813bfea24bb000dd0406d');
// * 모든 강의 정보 저장
const updateClassLecturesAll = async () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    await saveClassLectures(c.classId, 'update');
  }
};
// * 자막 파일 복사(subtitles -> video)
const copySubtitles = (classId) => {
  const classJson = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  if (!classJson || classJson.length === 0) {
    return;
  }
  try {
    for (const lecture of classJson) {
      const lectureSlug = getLectureSlug(lecture);
      const subtitleName = lecture.subtitles.find((s) => s.lang === 'ko')?.name;
      const subtitleSrcPath = `${CLASS101_HTML_ROOT}/classes/${classId}/${lectureSlug}/subtitles/${subtitleName}`;
      const subtitleDstPath = `${CLASS101_VIDEO_ROOT}/${classId}/${lectureSlug}.vtt`;
      saveFile(subtitleDstPath, loadFile(subtitleSrcPath));
    }
  } catch (error) {
    console.error(`Error processing class ${classId}:`, error);
  }
};
const copySubtitlesAll = async () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    await copySubtitles(c.classId);
  }
};
// * 모든 강의 정보 저장
const redownClassLecturesAll = async () => {
  const redownLectures = loadJson(`${CLASS101_JSON_ROOT}/redownLectures.json`);
  const uniqueClassIds = [...new Set(redownLectures.map((l) => l.classId))];
  console.log(uniqueClassIds, uniqueClassIds.length);
  // const excepts = [
  //   '63da380c1aa45c000ef4d011',
  //   '65d832e0b03816000e133e6a',
  //   '63bd1f7b0e84ff000e67c862',
  //   '60c705a4e4f358000d671380',
  //   '6495303a17e0fc000e282687',
  //   '64b65c8be78815000ef6a0f6',
  //   '631d98200380e4006470968d',
  // ];
  // // const noLectureIds = ["5ef4d5bfc94e480dcb9f7862", "5d6c7cc15933780c5919e50e", "60e1073626b8e800148165f4", "6495303a17e0fc000e282687", "60c705a4e4f358000d671380"]
  // for (const classId of uniqueClassIds) {
  //   // for (const classId of excepts) {
  //   // for (const classId of noLectureIds) {
  //   // if (excepts.includes(classId)) {
  //   //   console.log(`@@@@@ ${classId} 제외`);
  //   //   continue;
  //   // }
  //   console.log(`@@@@@ ${classId} 강의 정보 저장 중...`);
  //   await saveClassLectures(classId as string, 'update');
  // }
};
const noLectureIds = () => {
  const lectures = loadJson(`${CLASS101_JSON_ROOT}/redownLectures.json`);
  for (const l of lectures) {
    if (!l.lectureId) {
      console.log(l.classId, l.sn);
    }
  }
};
const deleteErrorFolders = (classId) => {
  console.log(`@@@@@ ${classId} 삭제 예정`);
  const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  if (!lectures || lectures.length === 0) {
    return;
  }
  try {
    const lectureNames = lectures.map((lecture) => getLectureSlug(lecture));
    // console.log(lectureNames);
    const folders = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
    for (const folder of folders) {
      const folderName = folder.split('/').pop();
      if (!lectureNames.includes(folderName)) {
        console.log(`${folderName} 삭제 예정`);
        fs.rmdirSync(folder, {
          recursive: true,
        });
      }
    }
    console.log(`@@@@@ ${lectures.length} / ${folders.length}`);
  } catch (error) {
    console.error(`Error processing class ${classId}:`, error);
  }
};
const deleteErrorFoldersAll = () => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  for (const c of myclasses) {
    deleteErrorFolders(c.classId);
  }
};
// *** 실행(myclass 추가)
// await saveMyclassIds()
// await saveMyclassesFromMyclassIds() // await saveClassLectures('60dd9a6bc531190014d360c4');
// await processClasses()

// * 오류수정
// const errorLectures = loadJson(`${CLASS101_JSON_ROOT}/errorLectures.json`);
// const errorClassIds = [
//     ...new Set(errorLectures.map((l)=>l.classId))
// ];
// saveJson(`${CLASS101_JSON_ROOT}/errorClassIds.json`, errorClassIds);

// const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);

// const hasOverlappedLecture = (classId)=>{
//     const classObj = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
//     // * 중복된 lectureId가 있는지 확인
//     const lectureIds = classObj.map((l)=>l.lectureId);
//     const uniqueLectureIds = [...new Set(lectureIds)];
//     return lectureIds.length !== uniqueLectureIds.length;
// };

// const overlappedClassIds = [];
// for (const c of myclasses){
//     if (hasOverlappedLecture(c.classId)){
//         overlappedClassIds.push(c.classId);
//     }
// }
// saveJson(`${CLASS101_JSON_ROOT}/overlappedClassIds.json`, overlappedClassIds);

// !! * 중복 강의 찾기 !!
const findOverlappedLectures = (save = false) => {
  const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
  const overlappedLectures = [];

  for (const c of myclasses) {
    const classObj = loadJson(`${CLASS101_JSON_ROOT}/classes/${c.classId}.json`);

    // lectureId별 강의 목록 생성
    const lectureMap = new Map();
    classObj.forEach((lecture) => {
      if (lecture.lectureId) {
        if (!lectureMap.has(lecture.lectureId)) {
          lectureMap.set(lecture.lectureId, []);
        }
        lectureMap.get(lecture.lectureId).push({
          classId: c.classId,
          sn: lecture.sn,
          lectureId: lecture.lectureId,
          title: lecture.title,
        });
      }
    });

    // 중복된 lectureId 찾기
    for (const [lectureId, lectures] of lectureMap) {
      if (lectures.length > 1) {
        console.log(`중복 발견 - classId: ${c.classId}, lectureId: ${lectureId}`);
        console.log('중복된 강의들:', lectures);
        overlappedLectures.push(...lectures);
      }
    }
  }

  // 결과 저장
  if (overlappedLectures.length > 0) {
    saveJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`, overlappedLectures);
    console.log(`총 ${overlappedLectures.length}개의 중복 강의 발견`);
  }

  if (save) {
    saveJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`, overlappedLectures);
  }
  return overlappedLectures;
};

// const classIds = ['5d31bb48125d26d5fb37241a'];
const findOverlappedHtmls = (save = false) => {
  const classIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  // const classIds = loadJson(`${CLASS101_JSON_ROOT}/overlappedClassIds.json`);
  const overlappedHtmls = [];

  for (const classId of classIds) {
    const folders = findFolders(`${CLASS101_HTML_ROOT}/classes/${classId}`);
    const folderNames = folders.map((f) => f.split('/').pop());
    const prefixes = folderNames.map((f) => f.split('_')[0]);
    const duplicates = prefixes.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {});

    for (const [prefix, count] of Object.entries(duplicates)) {
      if (count > 1) {
        const lectureIds = folderNames.filter((f) => f.startsWith(prefix)).map((f) => f.split('_')[1]);
        // console.log(`접두사 ${prefix}는 ${count}번 중복됩니다.`);
        overlappedHtmls.push({
          classId,
          prefix,
          count,
          lectureIds,
        });
      }
      if (count > 2) {
        console.log(`3번 이상 중복된 강의: ${classId} / ${prefix} / ${count}번 중복됩니다.`);
      }
    }
  }

  if (save) {
    saveJson(`${CLASS101_JSON_ROOT}/overlappedHtmls.json`, overlappedHtmls);
  }

  return overlappedHtmls;
};

function findLectureIdsLessThanSn(classId, sn) {
  const classObj = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
  const lectureIds = classObj.filter((l) => l.sn < sn).map((l) => l.lectureId);
  return lectureIds;
}

function checkOverlappedHtmls(save = false) {
  const correctLectureIds = [];
  const wrongLectureIds = [];
  const overlappedHtmls = loadJson(`${CLASS101_JSON_ROOT}/overlappedHtmls.json`);
  console.log('-------------------------------------------------');
  console.log(`overlappedHtmls: ${JSON.stringify(overlappedHtmls, null, 2)}`);
  console.log('-------------------------------------------------');

  for (const overlappedHtml of overlappedHtmls) {
    const classId = overlappedHtml.classId;
    const sn = parseInt(overlappedHtml.prefix);
    const beforeLectureIds = findLectureIdsLessThanSn(classId, sn);
    const lectureIds = overlappedHtml.lectureIds;
    console.log(`### checking ${classId} / ${sn} / ${lectureIds}`);
    for (const lectureId of lectureIds) {
      if (beforeLectureIds.includes(lectureId)) {
        console.log(`중복된 강의: ${classId} / ${sn} / ${lectureId}`);
        wrongLectureIds.push({
          classId,
          sn,
          lectureId,
        });
      } else {
        console.log(`중복되지 않은 강의: ${classId} / ${sn} / ${lectureId}`);
        correctLectureIds.push({
          classId,
          sn,
          lectureId,
        });
      }
    }
  }
  if (save) {
    saveJson(`${CLASS101_JSON_ROOT}/_correctLectureIds.json`, correctLectureIds);
    saveJson(`${CLASS101_JSON_ROOT}/_wrongLectureIds.json`, wrongLectureIds);
  }
  return {
    correctLectureIds,
    wrongLectureIds,
  };
}

function removeWrongHtmlFolders() {
  const wrongLectureIds = loadJson(`${CLASS101_JSON_ROOT}/_wrongLectureIds.json`);
  for (const wrongLectureId of wrongLectureIds) {
    const folderName = `${wrongLectureId.sn.toString().padStart(3, '0')}_${wrongLectureId.lectureId}`;
    const folderPath = `${CLASS101_HTML_ROOT}/classes/${wrongLectureId.classId}/${folderName}`;
    if (fs.existsSync(folderPath)) {
      console.log(`삭제 예정: ${folderPath}`);
      fs.rmdirSync(folderPath, { recursive: true });
    }
  }
}

function correctClassJson() {
  const correctLectureIds = loadJson(`${CLASS101_JSON_ROOT}/_correctLectureIds.json`);
  for (const correctLecture of correctLectureIds) {
    const jsonPath = `${CLASS101_JSON_ROOT}/classes/${correctLecture.classId}.json`;
    const classObj = loadJson(jsonPath);
    const targetLecture = classObj.find((l) => l.sn === correctLecture.sn);
    targetLecture.lectureId = correctLecture.lectureId;
    saveJson(jsonPath, classObj);
  }
}

// // * 실행
// findOverlappedLectures(true);
// findOverlappedHtmls(true);
// checkOverlappedHtmls(true);
// removeWrongHtmlFolders();
// correctClassJson();

// for (const folderName of folderNames){
//     const sn = folderName.split('_')[0];
//     if (folderNames.includes()){
//         console.log(folderName);
//     }
// }

// * 중복 강의 정보 재추출
// const classId = "5fd5b0e9d56d4e001538b829" // 인간관계
// const classId = "606e2ce995f580000e2da438" // 스토리
// await saveClassLectures(classId, 'update', 46);
// const html = loadFile(`${CLASS101_HTML_ROOT}/classes/606e2ce995f580000e2da438/index.html`);
// const lectures = extractLectures(html);
// console.log(lectures, lectures.length);

// // *
// const correctLectures = loadJson(`${CLASS101_JSON_ROOT}/_correctLectureIds_3.json`);
// const redownLectures = [];
// const redownClassIds = []

// for (const correctLecture of correctLectures){
//     if (!redownClassIds.includes(correctLecture.classId)) {
//         redownClassIds.push(correctLecture.classId);
//         redownLectures.push({
//             classId: correctLecture.classId,
//             lectures: [
//                 {sn: correctLecture.sn, lectureId: correctLecture.lectureId}
//             ]
//         });
//     } else {
//         redownLectures.find((l)=>l.classId === correctLecture.classId).lectures.push({sn: correctLecture.sn, lectureId: correctLecture.lectureId});
//     }
// }

// saveJson(`${CLASS101_JSON_ROOT}/_redownLectures.json`, redownLectures);

// await saveClassLectures(correctLecture.classId, 'update', [correctLecture.sn]);

// saveJson(`${CLASS101_JSON_ROOT}/_redownLectures.json`, redownLectures);

// * !!!! 다시 다운로드
const redownClassLectures = loadJson(`${CLASS101_JSON_ROOT}/_redownLectures.json`);

for (const redownClassLecture of redownClassLectures) {
  await saveClassLectures(redownClassLecture.classId, 'update', redownClassLecture.lectures);
}

// const foldersFromJson = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`).map((lecture)=>`${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`);
// console.log(folders.map((f)=>f.split('/').pop()));
// console.log(foldersFromJson);

// const processedFolders = []

// const redownLectures = async (classId)=>{
//     console.log(`@@@@@ ${classId} 강의 정보 저장 중...`);
//     let chrome = null;
//     const url = `https://class101.net/ko/classes/${classId}`;
//     chrome = await goToUrl(url);
//     await sleepAsync(3000);
//     const html = await chrome.getPageSource();

//     const errorLectures = loadJson(`${CLASS101_JSON_ROOT}/overlappedLectures.json`).filter((_, index) => index % 2 === 1)
//     const _lectures = errorLectures.filter((l)=>l.classId === classId);
//     const firstSn = _lectures[0].sn;
//     // console.log(sns);
//     // const sns = errorLectures.filter((l)=>l.classId === classId).map((l)=>l.sn);
//     // console.log(sns);

//     const lectures = extractLectures(html);  // 강의 목록
//     saveJson(`${CLASS101_JSON_ROOT}/lectures_${classId}.json`, lectures);
//     // const lectures = extractLectures(html, sns);  // 강의 목록
//     console.log(lectures);
//     const originalLectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`);
//     for (const lecture of lectures){
//         if (lecture.sn < firstSn - 2) {
//             continue;
//         }
//         // if (_lectures.find((l)=>l.sn !== lecture.sn)) {
//         //     // await sleepAsync(1000);
//         //     console.log(`skip: ${lecture.sn}`);
//         //     continue;
//         // }
//         // console.log(`!!!!!!! ${lecture.sn}`);
//         try {
//             // * 강의 버튼 클릭
//             // 제목으로 버튼 찾기 (따옴표 처리)
//             const escapedTitle = lecture.title.replace(/"/g, "', '\"', '");
//             console.log(`escapedTitle: ${escapedTitle}`);
//             console.log(`####강의 정보 수집중: ${lecture.title} (${lecture.sn}번째)`);
//             // const xpath_ = `//button[contains(@class, "css-1hvtp3b")][.//span[contains(@class, "css-1h8wj8h")]]`;
//             const xpath_ = `//button[@class="css-1hvtp3b"][.//span[@class="css-1h8wj8h" or @class="css-9a1m73"]]`;
//             // css-9a1m73
//             const titleButtons = await chrome.driver.findElements(By.xpath(xpath_));
//             let button = titleButtons[lecture.sn - 1];
//             if (!button) {
//                 console.error(`@@@@@@@@@@@@@@@@@@@@@@강의 버튼을 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
//                 // continue;
//                 return;
//             }
//             await button.click();

//             // const videoCss = 'div#vjs_video_3 > video';
//             const videoCss = 'video';
//             // await chrome.waitForElementVisible('div#vjs_video_3 > video');
//             try {
//                 await chrome.driver.wait(until.elementLocated(By.css(videoCss)), 5000);
//             } catch (error) {
//                 console.error(`!!!!강의 비디오를 찾을 수 없습니다: ${lecture.title} (${lecture.sn}번째)`);
//             // continue;
//             }
//             await sleepAsync(2000);
//             // * lectureId 추출
//             const url_ = await chrome.driver.getCurrentUrl();
//             const lectureId = url_.split('/')[7];
//             console.log(`lectureId: ${lectureId}`);
//             lecture.lectureId = lectureId;

//             // 원본 강의에서 동일한 sn을 가진 강의 찾기
//             const originalLecture = originalLectures.find(l => l.sn === lecture.sn);
//             if (originalLecture && originalLecture.lectureId === lectureId && originalLecture.title === lecture.title) {
//                 // console.log(`XXXX이미 처리된 강의입니다: ${lecture.title} (${lecture.sn}번째)`);
//                 continue;
//             }

//             console.log(`!!!!!!!!!!!!!!!!!!!!! 처리 중: ${lecture.title} (${lecture.sn}번째)`);

//             // * video division html 저장
//             const lectureDir = `${CLASS101_HTML_ROOT}/classes/${classId}/${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`;
//             const html = await chrome.getElementHtml(videoCss);
//             saveFile(`${lectureDir}/video.html`, html, {
//                 newFile: false
//             });
//             // * 수업자료 추출
//             await getMaterial(lecture, lectureDir, chrome);
//             // * 자막 다운로드(추가)
//             await downloadLectureSubtitles(classId, lectureId);
//             // !! 자막 정보 저장 추가
//             const vttInfos = await downloadVttFiles(html, `${lectureDir}/subtitles`);
//             lecture.subtitles = vttInfos;
//             // * 원본 강의 정보 업데이트
//             const targetIndex = originalLectures.findIndex((l) => l.sn === lecture.sn);
//             if (targetIndex !== -1) {
//                 originalLectures[targetIndex] = lecture;
//             }
//             saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, originalLectures);
//         } catch (error) {
//             // 타입 명시
//             console.error(`강의 처리 중 오류 발생 (${lecture.title}):`, error);
//             // 브라우저가 닫혔다면 다시 열기
//             if (error.name === 'NoSuchWindowError') {
//                 if (chrome) {
//                     await chrome.close();
//                 }
//                 chrome = await goToUrl(url);
//                 await sleepAsync(5000);
//             }
//             continue;
//         }
//     }
//     // 최종 결과 저장
//     // saveJson(`${CLASS101_JSON_ROOT}/classes/${classId}.json`, lectures);
// };

// const classIds = loadJson(`${CLASS101_JSON_ROOT}/overlappedClassIds.json`);
// // // const classId = '5fd5b0e9d56d4e001538b829';
// // const classIds = ['5e71ab3edd13f46aa1bbe1fe']
// for (const classId of classIds){
//     if (classId === '5e71ab3edd13f46aa1bbe1fe') {
//         continue;
//     }
//     await redownLectures(classId)
// }

// const originalLectures = loadJson(`${CLASS101_JSON_ROOT}/classes/5e71ab3edd13f46aa1bbe1fe.json`);
// console.log(originalLectures);

// // 실행 예시:
// const overlappedLectures = findOverlappedLectures();

// // * 디렉토리 삭제
// const errorClassIds = loadJson(`${CLASS101_JSON_ROOT}/errorClassIds.json`);

// const HTML_DIR_ROOT = `${CLASS101_HTML_ROOT}/classes`;
// const JSON_DIR_ROOT = `${CLASS101_JSON_ROOT}/classes`;

// for (const classId of errorClassIds){
//     const htmlDir = `${HTML_DIR_ROOT}/${classId}`;
//     const jsonFile = `${JSON_DIR_ROOT}/${classId}.json`;
//     if (fs.existsSync(htmlDir)){
//         console.log(`${classId} 삭제 예정`);
//         fs.rmdirSync(htmlDir, {
//             recursive: true
//         });
//         fs.unlinkSync(jsonFile);  // 파일 삭제
//     }
// }

// const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
// const unprocessedClasses = JSON.parse(JSON.stringify(myclasses));
// // const unprocessedClasses = myclasses.filter((c)=>!c.step.includes('S'));

// let errorLectures = [];

// for (const c of unprocessedClasses) {
//     console.log(c.classId);
//     const lectures = loadJson(`${CLASS101_JSON_ROOT}/classes/${c.classId}.json`);
//     for (const l of lectures) {
//         if ('subtitles' in l) {
//             continue;
//         }
//         console.log(c.classId);
//         errorLectures.push({
//             classId: c.classId,
//             sn: l.sn,
//             lectureId: l.lectureId
//         });
//         saveJson(`${CLASS101_JSON_ROOT}/errorLectures.json`, errorLectures);
//         // console.log("=================================================")
//         // console.log(`자막 다운로드 중: ${c.title}  ${c.classId}/${l.sn}_${l.lectureId}`);
//         // console.log("-------------------------------------------------")
//         // await downloadLectureSubtitles(c.classId, l.lectureId);
//         // await sleepAsync(1000);
//     }

//     // // 원본 myclasses에서 해당 class를 찾아 업데이트
//     // const targetClass = myclasses.find((mc) => mc.classId === c.classId);
//     // if (targetClass) {
//     //     targetClass.step += 'S';
//     //     saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
//     // }
// }

// // * 중복된 강의 정보 재추출, 강의 자료 다운로드, 자막 다운로드
// // # main functions
// // step: 'L': 강의 정보 추출 완료, 'M': 강의 자료 다운로드 완료, 'V': 비디오 다운로드 완료, 'S': 자막 다운로드 완료
// const processOverlappedClasses = async ()=>{
//     const myclasses = loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`);
//     // step이 없는 경우 빈 문자열로 초기화
//     myclasses.forEach((c)=>{
//         if (!c.step) c.step = '';
//     });
//     // step: 'L': 강의 정보 추출 완료, 'M': 강의 자료 다운로드 완료, 'V': 비디오 다운로드 완료, 'S': 자막 다운로드 완료
//     const unprocessedClasses = myclasses.filter((c)=>!c.step.includes('L'));
//     for (const c of unprocessedClasses){
//         try {
//             console.log(`강의 정보 추출 중: ${c.classId}`);
//             await saveClassLectures(c.classId);
//             // 원본 myclasses에서 해당 class를 찾아 업데이트
//             const targetClass = myclasses.find((mc)=>mc.classId === c.classId);
//             if (targetClass) {
//                 targetClass.step += 'L';
//                 saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
//             }
//             await sleepAsync(5000);
//         } catch (error) {
//             console.error(`Error processing class ${c.classId}:`, error);
//             continue;
//         }
//     }
// };
