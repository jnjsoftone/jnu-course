// ** my-classes

const fetchMyClassesHtml = async () => {
  const url = `https://class101.net/ko/my-classes`;
  const chrome = await goToUrl(url, { scroll: true });
  const html = await chrome.getPageSource();

  await chrome.close();
  return html;
};

const parseMyClassesHtml = (html: string) => {
  const $ = cheerio.load(html);
  const classes: any[] = [];

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
  return loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`).map((c: any) => c.classId);
};

const _convMyClassIds = () => {
  saveJson(`${CLASS101_JSON_ROOT}/myclassIds.json`, getMyClassIds());
};

// * myclassIds 저장
const saveMyclassIds = async () => {
  console.log('@@@ saveMyclassIds1');
  let myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const url = 'https://class101.net/ko/my-classes';
  const chrome = await goToUrl(url, { scroll: true });
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
        // 에러 발생시 다음 요소로 진행
        continue;
      }
    }

    return myclassIds;
  } finally {
    await chrome.close();
  }
};

// * myclassIds -> myclasses 생성
const saveMyclassesFromMyclassIds = () => {
  const myclassIds = loadJson(`${CLASS101_JSON_ROOT}/myclassIds.json`);
  const myclasses = existsFile(`${CLASS101_JSON_ROOT}/myclasses.json`)
    ? loadJson(`${CLASS101_JSON_ROOT}/myclasses.json`)
    : [];

  myclassIds.forEach(async (classId: string) => {
    const products = loadJson(`${CLASS101_JSON_ROOT}/products.json`);
    const product = products.find((p: any) => p.klassId === classId);
    if (product) {
      const { title, productId, categoryId, authorId } = products.find((p: any) => p.klassId === classId);
      // myclasses에 classId가 없으면 추가 있으면 업데이트
      const index = myclasses.findIndex((c: any) => c.classId === classId);
      if (index === -1) {
        myclasses.push({ title, classId, productId, categoryId, authorId, step: '' });
      } else {
        // myclasses[index] = {title, classId, productId, categoryId, authorId, step: ''};
      }
    } else {
      console.log(`#### ${classId} 정보가 없습니다.`);
    }
  });

  saveJson(`${CLASS101_JSON_ROOT}/myclasses.json`, myclasses);
};
