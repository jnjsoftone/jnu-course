# SWC (Speedy Web Compiler)

## 개요
SWC는 Rust로 작성된 매우 빠른 JavaScript/TypeScript 컴파일러입니다. Babel의 대안으로 사용되며, 더 나은 성능을 제공합니다.

## 설치

```bash
# npm으로 설치
npm install -D @swc/cli @swc/core

# yarn으로 설치
yarn add -D @swc/cli @swc/core
```

## 기본 사용법

```bash
# TypeScript 파일 컴파일
swc src -d dist

# 감시 모드로 실행
swc src -d dist -w
```

## .swcrc 설정

### 기본 구조
```json
{
  "$schema": "https://json.schemastore.org/swcrc",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": false,
      "decorators": false,
      "dynamicImport": false
    },
    "target": "es2020",
    "loose": false,
    "minify": {
      "compress": {
        "unused": true,
        "dead_code": true,
        "conditionals": true,
        "sequences": true,
        "passes": 2
      },
      "mangle": true
    }
  },
  "module": {
    "type": "es6",  // 또는 "commonjs"
    "strict": false,
    "strictMode": true,
    "lazy": false,
    "noInterop": false
  },
  "minify": true,
  "isModule": true,
  "comments": false
}
```

### 주요 설정 옵션

#### 1. Parser 설정 (`jsc.parser`)
- `syntax`: 파싱할 언어 선택 ("typescript" | "ecmascript")
- `tsx`: TSX 지원 여부
- `decorators`: 데코레이터 지원 여부
- `dynamicImport`: 동적 import 지원 여부

#### 2. 컴파일 타겟 (`jsc.target`)
- `es3`, `es5`, `es2015` ~ `es2022` 지원
- `es2020` 권장 (Node.js 14 이상 지원)

#### 3. 모듈 설정 (`module`)
- `type`: 모듈 시스템 선택
  - `es6`: ES Modules
  - `commonjs`: CommonJS
- `strict`: 엄격한 모드
- `lazy`: 지연 로딩
- `noInterop`: 인터롭 처리 비활성화

#### 4. 최적화 설정 (`minify`, `jsc.minify`)
```json
{
  "minify": true,  // 전체 최적화 활성화
  "jsc": {
    "minify": {
      "compress": {
        "unused": true,     // 미사용 코드 제거
        "dead_code": true,  // 도달할 수 없는 코드 제거
        "conditionals": true,  // 조건문 최적화
        "sequences": true,   // 연속된 구문 최적화
        "passes": 2         // 최적화 반복 횟수
      },
      "mangle": true  // 변수명 축소
    }
  }
}
```

#### 5. 주석 처리 (`comments`)
- `true`: 주석 유지
- `false`: 주석 제거

## 환경별 설정 예시

### 개발 환경
```json
{
  "minify": false,
  "jsc": {
    "minify": {
      "compress": false,
      "mangle": false
    }
  },
  "comments": true
}
```

### 프로덕션 환경
```json
{
  "minify": true,
  "jsc": {
    "minify": {
      "compress": {
        "unused": true,
        "dead_code": true,
        "conditionals": true,
        "sequences": true,
        "passes": 2
      },
      "mangle": true
    }
  },
  "comments": false
}
```

## 주의사항

1. 소스맵 생성
   - 디버깅을 위해 개발 환경에서는 소스맵 활성화 권장
   ```json
   {
     "sourceMaps": true,
     "module": {
       "type": "es6"
     }
   }
   ```

2. TypeScript 설정과의 호환성
   - `tsconfig.json`의 설정과 충돌하지 않도록 주의
   - 특히 `module`, `target` 설정 확인

3. 성능 최적화
   - 불필요한 최적화 옵션은 비활성화
   - 개발 환경에서는 빌드 속도를 위해 최적화 비활성화
   - 프로덕션 환경에서만 전체 최적화 활성화

## 참고 자료
- [SWC 공식 문서](https://swc.rs/docs/configuration/swcrc)
- [SWC Playground](https://play.swc.rs/)
