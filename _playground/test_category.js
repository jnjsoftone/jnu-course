import { Cheer } from 'jnu-doc';
// import { Chrome } from 'jnu-web';
// import { parseNextData, dataFromNextData } from './utils/parse';
import { loadJson, saveJson, sanitizeName, PLATFORM } from 'jnu-abc';
import dotenv from 'dotenv';
dotenv.config({ path: `../.env.${PLATFORM}` });

const { CLASS101_CATEGORY_URL, CLASS101_JSON_ROOT } = process.env;

// const url = 'https://class101.net/ko/categories';
// const JSON_ROOT = `C:/JnJ/Developments/Utils/jnu-course/data/class101/json`;

// &------------------------------------

const parseNextData = (html) => {
  const cheer = new Cheer(html);
  return JSON.parse(cheer.value('#__NEXT_DATA__'));
};

const dataFromNextData = (nextData) => {
  return nextData.props.apolloState.data;
};

// &------------------------------------

// nextData에서 카테고리 정보 추출
const _mainCategories = async (data) => {
  // const data = nextData.props.apolloState.data;
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
          title: sanitizeName(childCategory.title),
        });
      });
    }
  });

  return data_;
};

// * 부카테고리
const _subCategories = (data, ancestorId) => {
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

const _subCategoriesByCategoryId = async (categoryId) => {
  const url = `${CLASS101_CATEGORY_URL}/${categoryId}`;
  const html = await fetch(url).then((res) => res.text());
  const data = dataFromNextData(parseNextData(html));
  return await _subCategories(data, categoryId);
};

// * Main Function

const fetchMainCategories = async (savePath = `${CLASS101_JSON_ROOT}/categories.json`, save = false) => {
  const url = CLASS101_CATEGORY_URL;
  const html = await fetch(url).then((res) => res.text());
  const data = dataFromNextData(parseNextData(html));
  // console.log(`${url}`, data);
  const mainCategories = await _mainCategories(data);
  // console.log(`${mainCategories}`, mainCategories);
  if (save) {
    saveJson(savePath, mainCategories);
  }
  return mainCategories;
};

const fetchSubCategories = async (
  savePath = `${CLASS101_JSON_ROOT}/subCategories.json`,
  save = false,
  mainCategories = []
) => {
  let subCategories = [];
  if (mainCategories.length === 0) {
    mainCategories = loadJson(`${CLASS101_JSON_ROOT}/categories.json`);
  }
  for (const mainCategory of mainCategories) {
    subCategories = [...subCategories, ...(await _subCategoriesByCategoryId(mainCategory.categoryId))];
  }
  if (save) {
    saveJson(savePath, subCategories);
  }
  return subCategories;
};

// * TEST
// await fetchMainCategories(CLASS101_CATEGORY_URL, `${CLASS101_JSON_ROOT}/categories.json`, true);
await fetchSubCategories(`${CLASS101_JSON_ROOT}/subCategories.json`, true, []);

//
