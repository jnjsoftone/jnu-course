# 테스트 가이드

## 목차
- [테스트 환경 설정](#테스트-환경-설정)
- [테스트 실행 방법](#테스트-실행-방법)
- [테스트 작성 가이드](#테스트-작성-가이드)
- [테스트 유형별 설명](#테스트-유형별-설명)
- [Jest 설정 상세](#jest-설정-상세)

## 테스트 환경 설정

### 폴더 구조
```
project-root/
├── tests/
│   ├── __fixtures__/    # 테스트 데이터
│   ├── __mocks__/       # 모의 객체
│   ├── unit/            # 단위 테스트
│   │   ├── __snapshots__/
│   │   └── *.test.ts
│   ├── integration/     # 통합 테스트
│   ├── e2e/            # E2E 테스트
│   └── utils/          # 테스트 유틸리티
│       ├── unit.setup.ts
│       ├── integration.setup.ts
│       └── e2e.setup.ts
```

### 필요한 패키지
```json
{
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1"
  }
}
```

## 테스트 실행 방법

### NPM 스크립트
```bash
# 모든 테스트 실행
npm test

# 단위 테스트만 실행
npm run test:unit

# 통합 테스트만 실행
npm run test:integration

# E2E 테스트만 실행
npm run test:e2e

# 테스트 감시 모드 실행
npm run test:watch

# 테스트 커버리지 보기
npm run test:coverage
```

### 특정 테스트 파일만 실행
```bash
# 특정 파일만 실행
npm test basic.test.ts

# 특정 테스트 설명으로 필터링
npm test -t "should return pong"
```

## 테스트 작성 가이드

### 기본 테스트 구조
```typescript
import { functionToTest } from '../src/module';

describe('모듈/기능 이름', () => {
  // 테스트 전 준비
  beforeAll(() => {
    // 모든 테스트 전에 1회 실행
  });

  beforeEach(() => {
    // 각 테스트 케이스 전에 실행
  });

  // 테스트 케이스
  it('should do something', () => {
    // 준비 (Arrange)
    const input = 'test';

    // 실행 (Act)
    const result = functionToTest(input);

    // 검증 (Assert)
    expect(result).toBe('expected result');
  });

  // 정리
  afterEach(() => {
    // 각 테스트 케이스 후에 실행
  });

  afterAll(() => {
    // 모든 테스트 후에 1회 실행
  });
});
```

### Jest Matcher 사용법
```typescript
// 동등 비교
expect(value).toBe(expected);
expect(value).toEqual(expected);

// 진리값 검사
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// 널/언디파인드 검사
expect(value).toBeNull();
expect(value).toBeUndefined();

// 배열/객체 포함 검사
expect(array).toContain(item);
expect(object).toHaveProperty('key');

// 예외 처리 검사
expect(() => {
  throw new Error('test');
}).toThrow('test');
```

## 테스트 유형별 설명

### 단위 테스트 (Unit Tests)
- 개별 함수나 컴포넌트를 독립적으로 테스트
- 외부 의존성은 모킹(mocking)하여 처리
- `tests/unit/` 디렉토리에 작성
- 파일명: `*.test.ts`

### 통합 테스트 (Integration Tests)
- 여러 컴포넌트나 모듈 간의 상호작용 테스트
- 실제 의존성을 사용하여 테스트
- `tests/integration/` 디렉토리에 작성
- 파일명: `*.test.ts`
- 기본 타임아웃: 30초

### E2E 테스트 (End-to-End Tests)
- 전체 시스템을 실제 사용자 관점에서 테스트
- 실제 환경과 유사한 조건에서 테스트
- `tests/e2e/` 디렉토리에 작성
- 파일명: `*.test.ts`
- 기본 타임아웃: 60초

## Jest 설정 상세

### 기본 설정 (jest.config.js)
```javascript
{
  preset: 'ts-jest',                // TypeScript 지원
  testEnvironment: 'node',          // Node.js 환경
  roots: ['<rootDir>/src', '<rootDir>/tests'], // 테스트 검색 경로
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'], // 테스트 파일 패턴
  transform: {
    '^.+\\.tsx?$': ['ts-jest']     // TypeScript 변환 설정
  },
  collectCoverageFrom: [            // 커버리지 수집 대상
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',    // 커버리지 리포트 저장 위치
  coverageReporters: ['text', 'lcov'], // 커버리지 리포트 형식
  verbose: true                     // 상세 로그 출력
}
```

### 환경별 설정
- 단위 테스트 (jest.unit.js)
- 통합 테스트 (jest.integration.js)
- E2E 테스트 (jest.e2e.js)

각 환경별로 다음과 같은 설정을 커스터마이즈할 수 있습니다:
- testMatch: 테스트 파일 패턴
- setupFilesAfterEnv: 테스트 준비 스크립트
- testTimeout: 테스트 타임아웃
- displayName: 테스트 표시 이름

## 모범 사례

### 테스트 케이스 작성
1. 테스트 설명은 명확하고 구체적으로 작성
2. 하나의 테스트는 하나의 동작만 검증
3. AAA (Arrange-Act-Assert) 패턴 사용
4. 테스트 데이터는 fixtures 활용
5. 반복되는 설정은 beforeEach/beforeAll 활용

### 테스트 구조화
1. 관련 테스트는 describe 블록으로 그룹화
2. 공통 설정은 상위 describe 블록에 작성
3. 복잡한 테스트는 여러 describe 블록으로 계층화

### 모킹 (Mocking)
```typescript
// 함수 모킹
jest.fn();
jest.spyOn(object, 'method');

// 모듈 모킹
jest.mock('./module');

// 타이머 모킹
jest.useFakeTimers();
```

## 참고 자료
- [Jest 공식 문서](https://jestjs.io/)
- [ts-jest 문서](https://kulshekhar.github.io/ts-jest/)
