// * 강의 소개 페이지(home.html) 다운로드

import { saveFile, sleepAsync } from 'jnj-utils';

const baseUrl = 'http://125.133.148.194:4000';
const productBaseUrl = 'https://class101.net/ko/products';
// http://125.133.148.194:4000/lecture/_repo/class101/json/myclasses_2.json

const fetchMyClasses = async () => {
  const response = await fetch(`${baseUrl}/lecture/_repo/class101/json/myclasses_2.json`);
  return response.json();
};

const getProductId = async (classId) => {
  const myClasses = await fetchMyClasses();
  const classInfo = myClasses.find((c) => c.classId === classId);
  if (!classInfo) {
    throw new Error(`Class not found for classId: ${classId}`);
  }
  return classInfo.productId;
};

const fetchClassHtml = async (classId) => {
  const productId = await getProductId(classId);
  const url = `${productBaseUrl}/${productId}`;
  const response = await fetch(url);
  return response.text();
};

const saveHtml = async (classId) => {
  const html = await fetchClassHtml(classId);
  const filename = `classes/${classId}/home.html`;
  await saveFile(filename, html);
};

const saveAllHtml = async () => {
  const myClasses = await fetchMyClasses();
  for (const classInfo of myClasses) {
    // console.log(classInfo.classId);
    await saveHtml(classInfo.classId);
    await sleepAsync(1000);
  }
  console.log(`${myClasses.length}개 클래스 홈페이지 저장 완료`);
};

export { fetchClassHtml, saveHtml, saveAllHtml };

await saveAllHtml();
