# 세계 프리다이빙 & 해양생물 도감

33개국 248개 프리다이빙·스쿠버 포인트와 월별 해양생물 캘린더를 담은 정적 웹사이트입니다.
빌드 과정이나 서버 없이 HTML·CSS·JS 파일만으로 동작하며, 외부 지도 라이브러리도 쓰지 않습니다.

## 폴더 구조

```
index.html        페이지 뼈대
css/style.css     디자인
js/data.js        국가·포인트·해양생물 데이터 ← 스팟 추가·수정은 여기서
js/map-land.js    세계 해안선 지도 데이터 (Natural Earth, 퍼블릭 도메인)
js/app.js         화면 렌더링·지도 확대/이동·조건 검색 로직
favicon.svg       브라우저 탭 아이콘
vercel.json       Vercel 설정
```

## 배포 방법 (GitHub → Vercel)

1. GitHub에서 새 저장소를 만듭니다.
2. 이 폴더 안의 파일을 전부 저장소 **최상위**에 올립니다.
   `index.html`이 저장소 첫 화면에 바로 보여야 합니다.
3. Vercel에서 **Add New → Project**를 누르고 방금 만든 저장소를 **Import**합니다.
4. 설정 화면은 그대로 두고 **Deploy**를 누릅니다.
   - Framework Preset: `Other`
   - Build Command·Output Directory: 비워 둠
5. 배포가 끝나면 `https://<프로젝트명>.vercel.app` 링크가 생깁니다.

이후에는 GitHub에 파일을 수정해서 올릴 때마다 Vercel이 자동으로 다시 배포합니다.

## 스팟 추가하기

`js/data.js`의 해당 국가 `points` 배열에 아래 형식으로 한 항목을 추가합니다.
`region` 값이 같은 포인트끼리 상세 페이지에서 같은 지역 탭으로 묶입니다.

```js
{
 "name": "포인트 이름",
 "region": "지역 탭 이름",
 "entry": "보트",
 "avgDepth": "5~15m", "maxDepth": "20m", "viz": "10~20m",
 "level": "입문",
 "lat": 9.9436, "lng": 123.3936,
 "free": 5, "scuba": 4,
 "preview": "지역 탭에 보이는 생물 미리보기",
 "note": "포인트 설명",
 "free_tips": "프리다이버 팁",
 "scuba_tips": "스쿠버다이버 팁",
 "caution": { "조류": "보통", "초보자안전성": "낮음" }
}
```

- `level`: 입문 / 초급 / 중급 / 중상급 / 상급 / 전문가 / 해당없음
- `caution` 값: 낮음 / 보통 / 높음 / 매우 높음
- `lat`, `lng`: 위도·경도 (남반구 위도, 서반구 경도는 음수)

## 로컬에서 미리 보기

`index.html`을 브라우저로 바로 열면 됩니다.

## 참고

포인트의 수심·시즌·좌표는 일반적인 공개 정보를 바탕으로 정리한 참고용 자료입니다.
실제 다이빙 전에는 현지 다이빙센터와 해양보호구역 공식 정보를 꼭 확인하세요.
