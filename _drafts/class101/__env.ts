import dotenv from 'dotenv';

// * 환경 설정 루트 경로
const { JNJ_LEARN_ROOT } = process.env;

// .env 파일 로드, !! 프로젝트 루트 경로 기준 !!
dotenv.config({ path: `${JNJ_LEARN_ROOT}/.env` });

// `/.env` 파일 환경 변수
const {
  CHROME_DEFAULT_USER_ID,
  CHROME_DEFAULT_USER_EMAIL,
  CHROME_DEFAULT_USER_DATA_DIR,
} = process.env;

// # class101
const CLASS101_JSON_ROOT = 'C:/JnJ-soft/Projects/internal/@jnjsoft/jnj-learn/_repo/class101/json';

const CLASS101_HTML_ROOT = 'C:/JnJ-soft/Projects/internal/@jnjsoft/jnj-learn/_repo/class101/html';
const CLASS101_VIDEO_ROOT = 'C:/JnJ-soft/Projects/internal/@jnjsoft/jnj-learn/_repo/class101/video';

export {
  CHROME_DEFAULT_USER_ID,
  CHROME_DEFAULT_USER_EMAIL,
  CHROME_DEFAULT_USER_DATA_DIR,
  CLASS101_JSON_ROOT,
  CLASS101_HTML_ROOT,
  CLASS101_VIDEO_ROOT,
};

// console.log(CHROME_DEFAULT_USER_ID);
