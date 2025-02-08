#!/bin/bash
# [syntax] ./publish.sh [patch|minor|major] [-m "commit message"]
# default: patch, "chore: build for publish"

mode="patch"
commit_msg="chore: build for publish"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -m)
      commit_msg="$2"
      shift 2
      ;;
    patch|minor|major)
      mode="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# 1. git pull 먼저 실행하여 원격 변경사항 가져오기
git pull && \
# 2. 빌드
npm run build && \
# 3. git 변경사항 커밋
git add . && \
git commit -m "$commit_msg" && \
# 4. npm 버전 업데이트 (이때 자동으로 버전 태그가 생성됨)
npm version $mode && \
# 5. git push
git push --follow-tags && \
# 6. npm 배포
npm publish