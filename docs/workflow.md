0. Requirements

## 환경 설정

### macos / linux
```ini:~/.zshrc
export DEV_ROOT="/Users/moon/JnJ/Developments"
```

### windows
> 시스템 환경 변수 편집
DEV_ROOT="C:\JnJ\Developments"


## xcli 설치

```sh
npm install -g jnu-abc
```

1. 프로젝트 생성/설정

## 프로젝트 생성

```sh
# <syntax> xcli -e init -r "[REPO_NAME]||[USER_NAME]||[TEMPLATE_NAME]||[DESCRIPTION]"
xcli -e init -r "jnu-course||jnjsoftone||ts-swc-npm||Jnjsoft Nodejs Utility Library for e-Learning Course(class101, udemy, inflearn, ...) Support Functions in Typescript"
```

## npm 패키지 설치
```sh
# jnu-abc(dotenv yargs @octokit/rest 포함) + 프로젝트 의존 패키지
npm install jnu-abc  --save
```

2. 프로젝트 개발

## cursor.ai 용 문서 수정

### `.cursorrules` 수정
```yaml:.cursorrules
```

### nodepads 용 파일 생성

```md:docs/cursor/requirements.md
```

### nodepads 등록

- cursor.ai > 설정 > NOTEPADS > '+ Create New Notepad'


3. publish

```sh
# npm login
npm login jnjsoftone

cd C:/JnJ/Developments/Utils/jnu-course

# macos / linux
./publish.sh

# windows
./publish.bat
```
