import json
import os
import re
from pathlib import Path

def sanitize_name(text):
    # 대괄호를 소괄호로 치환
    text = text.replace('[', '(').replace(']', ')')
    # 한글(AC00-D7A3), 영문자, 숫자, 밑줄, 괄호, 부등호, 쉼표, 공백만 남기고 제거
    text = re.sub(r'[^\uAC00-\uD7A3a-zA-Z0-9_\(\)\<\>\,\s]', '', text)
    # 연속된 공백을 하나로 변경
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def load_json_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_class_info(myclasses, target_class_id):
    for class_info in myclasses:
        if class_info.get('classId') == target_class_id:
            return class_info
    return None

def get_lecture_info(lectures, sn):
    for lecture in lectures:
        if lecture.get('sn') == sn:
            return lecture
    return None

def get_class_id_by_title(myclasses, title):
    sanitized_title = sanitize_name(title)
    for class_info in myclasses:
        if sanitize_name(class_info['title']) == sanitized_title:
            return class_info['classId']
    return None

def get_lecture_id_by_title_and_sn(lectures, title, sn):
    sanitized_title = sanitize_name(title)
    for lecture in lectures:
        if lecture['sn'] == sn and sanitize_name(lecture['title']) == sanitized_title:
            return lecture['lectureId']
    return None

def reverse_class101_files():
    base_dir = Path('/volume1/video/lecture/class101')
    repo_dir = Path('/volume1/video/lecture/_repo/class101')
    
    # myclasses.json 로드
    myclasses = load_json_file(repo_dir / 'json/myclasses.json')
    
    # 모든 디렉토리 순회
    for dir_path in base_dir.glob('*'):
        if not dir_path.is_dir():
            continue
            
        # classId 찾기
        class_id = get_class_id_by_title(myclasses, dir_path.name)
        if not class_id:
            print(f"클래스 ID를 찾을 수 없음: {dir_path}")
            continue
            
        # 강의 정보 로드
        lectures_file = repo_dir / f'json/classes/{class_id}.json'
        if not lectures_file.exists():
            print(f"강의 정보 파일을 찾을 수 없음: {lectures_file}")
            continue
            
        lectures = load_json_file(lectures_file)
        
        # 새로운 디렉토리 경로 (원래 classId로)
        new_dir_path = dir_path.parent / class_id
        
        # mkv와 vtt 파일 이름 변경
        for file_path in dir_path.glob('*.*'):
            if file_path.suffix not in ['.mkv', '.vtt']:
                continue

            # 파일명에서 정보 추출
            match = re.match(r'(\d{3})_(.+?)\.(mkv|vtt)$', file_path.name)
            if not match:
                continue
                
            sn = int(match.group(1))
            title = match.group(2)
            
            # lectureId 찾기
            lecture_id = get_lecture_id_by_title_and_sn(lectures, title, sn)
            if not lecture_id:
                print(f"강의 ID를 찾을 수 없음: {file_path}")
                continue
            
            # 원래 파일명으로 변경
            new_file_name = f"{sn:03d}_{lecture_id}{file_path.suffix}"
            new_file_path = new_dir_path / new_file_name
            
            # 디렉토리 생성 및 파일 이동
            new_dir_path.mkdir(exist_ok=True)
            file_path.rename(new_file_path)
            print(f"파일 이름 복원: {file_path} -> {new_file_path}")
        
        # 빈 디렉토리 삭제
        if not any(dir_path.iterdir()):
            dir_path.rmdir()
            print(f"빈 디렉토리 삭제: {dir_path}")

def rename_class101_files():
    base_dir = Path('/volume1/video/lecture/class101')
    repo_dir = Path('/volume1/video/lecture/_repo/class101')
    
    # myclasses.json 로드
    myclasses = load_json_file(repo_dir / 'json/myclasses.json')
    
    # 모든 디렉토리 순회
    for dir_path in base_dir.glob('*'):
        if not dir_path.is_dir():
            continue
            
        old_class_id = dir_path.name
        if not re.match(r'^[0-9a-f]{24}$', old_class_id):
            continue
            
        # 클래스 정보 찾기
        class_info = get_class_info(myclasses, old_class_id)
        if not class_info:
            print(f"클래스 정보를 찾을 수 없음: {old_class_id}")
            continue
            
        # 새로운 디렉토리 이름 생성 (classId 제거)
        new_dir_name = sanitize_name(class_info['title'])
        new_dir_path = dir_path.parent / new_dir_name
        
        # 강의 정보 로드
        lectures_file = repo_dir / f'json/classes/{old_class_id}.json'
        if not lectures_file.exists():
            print(f"강의 정보 파일을 찾을 수 없음: {lectures_file}")
            continue
            
        lectures = load_json_file(lectures_file)
        
        # mkv와 vtt 파일 이름 변경
        for file_path in dir_path.glob('*.*'):
            if file_path.suffix not in ['.mkv', '.vtt']:
                continue

            # 파일명에서 정보 추출 (mkv, vtt 파일 모두 동일한 패턴)
            match = re.match(r'(\d{3})_([0-9a-f]{24})\.(mkv|vtt)$', file_path.name)
            if not match:
                continue
                
            sn = int(match.group(1))
            
            # 강의 정보 찾기
            lecture_info = get_lecture_info(lectures, sn)
            if not lecture_info:
                print(f"강의 정보를 찾을 수 없음: {file_path}")
                continue
            
            # 새로운 파일명 생성
            new_file_name = f"{sn:03d}_{sanitize_name(lecture_info['title'])}{file_path.suffix}"
            new_file_path = new_dir_path / new_file_name
            
            # 디렉토리 생성 및 파일 이동
            new_dir_path.mkdir(exist_ok=True)
            file_path.rename(new_file_path)
            print(f"파일 이름 변경: {file_path} -> {new_file_path}")
        
        # 빈 디렉토리 삭제
        if not any(dir_path.iterdir()):
            dir_path.rmdir()
            print(f"빈 디렉토리 삭제: {dir_path}")

def remove_empty_directories():
    base_dir = Path('/volume1/video/lecture/class101')
    
    # 모든 디렉토리 순회
    for dir_path in base_dir.glob('*'):
        if not dir_path.is_dir():
            continue
            
        # @eaDir 폴더 삭제
        eadir = dir_path / '@eaDir'
        if eadir.exists():
            try:
                import shutil
                shutil.rmtree(eadir)
                print(f"@eaDir 폴더 삭제: {eadir}")
            except Exception as e:
                print(f"@eaDir 폴더 삭제 실패: {eadir} - {str(e)}")
        
        # _repo 폴더나 @_repo 폴더는 건너뛰기
        if dir_path.name in ['_repo', '@_repo']:
            continue
        
        # 디렉토리가 비어있는지 확인
        if not any(p for p in dir_path.iterdir() if p.name not in ['.', '..']):
            try:
                dir_path.rmdir()
                print(f"빈 디렉토리 삭제: {dir_path}")
            except Exception as e:
                print(f"디렉토리 삭제 실패: {dir_path} - {str(e)}")

if __name__ == '__main__':
    # 아래 함수들 중 필요한 것을 선택하여 실행
    rename_class101_files()  # 파일명을 제목으로 변경
    # reverse_class101_files() # 파일명을 원래대로 복원
    # remove_empty_directories() # 비어있는 폴더 삭제