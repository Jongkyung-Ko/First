# -*- coding: utf-8 -*-
"""Generate js/poem-fallback-data.js from canonical poem corpus."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "js", "poem-fallback-data.js")

POET_ID_TO_AUTHOR = {
    "kim_sowol": "김소월",
    "yun_dongju": "윤동주",
    "jung_jiyong": "정지용",
    "park_mokwol": "박목월",
    "seo_jungju": "서정주",
    "han_yongun": "한용운",
    "lee_yuksa": "이육사",
    "kim_suyoung": "김수영",
    "park_dujin": "박두진",
    "jo_jiho": "조지호",
    "baek_seok": "백석",
    "lee_sang": "이상",
    "jeong_hoseung": "정호승",
    "ko_un": "고은",
    "shin_kyungnim": "신경림",
    "kim_chunsu": "김춘수",
    "kim_kirim": "김기림",
    "kim_youngrang": "김영랑",
    "song_gok": "송곡",
    "cheon_sangbyeong": "천상병",
    "ki_muk": "기묵",
    "hwang_donggyu": "황동규",
    "shim_yuntaek": "심윤택",
    "lee_siyoung": "이시영",
    "choi_duseok": "최두석",
    "park_jaeha": "박재하",
    "yang_siu": "양시우",
    "kim_hyesun": "김혜순",
    "na_heeduk": "나희덕",
    "lee_yongak": "이용앙",
}

# poet_id -> list of {title, year, body}
CORPUS = {}

def add(poet_id, title, year, body):
    CORPUS.setdefault(poet_id, []).append({"title": title, "year": year, "body": body.strip()})

# --- kim_sowol ---
add("kim_sowol", "진달래꽃", "1925", """나 보기가 역겨워
가실 때에는
말없이 고이 보내 드리오리다

영변에 약산
진달래꽃
아름 따다 가실 길에 뿌리오리다

가시는 걸음걸음
놓인 그 꽃을
사랑이 가시어 가시거든

말없이 고이 보내 드리오리다

나 보기가 역겨워
가실 때에는
죽어도 아니 눈물 흘리오리다""")

add("kim_sowol", "엄마야 누나야", "1927", """엄마야 누나야
강변 살자

머리 맡에 학
고개 뒤에 옹
엄마야 누나야
강변 살자

엄마의 저녁노래
아니면 누나의
훨훨 나는 머루꽃 바람
그리울까
엄마야 누나야
강변 살자""")

add("kim_sowol", "초혼", "1925", """산산이 부서진 이름이여!
허공중에 헤어진 이름이여!
불러도 주인 없는 이름이여!
부르다가 내가 죽을 이름이여!

심중에 남아 있는 말 한마디는
끝끝내 마저하지 못하였구나.
사랑하던 그 사람이여!
사랑하던 그 사람이여!

붉은 해는 서산마루에 걸리었다.
사슴의 무리도 슬피 운다.
떨어져 나가 앉은 산 위에서
나는 그대의 이름을 부르노라.

설움에 겹도록 부르노라.
설움에 겹도록 부르노라.

부르는 소리는 비껴가지만
하늘과 땅 사이가 너무 넓구나.

선 채로 이 자리에 돌이 되어도
부르다가 내가 죽을 이름이여!
사랑하던 그 사람이여!
사랑하던 그 사람이여!""")

add("kim_sowol", "산유화", "1924", """산에는 꽃 피네
꽃이 피네
갈 봄 여름 없이
꽃이 피네

산에
산에
피는 꽃은
저만치 혼자서 피어 있네

산에서 우는 작은 새여
꽃이 좋아
산에서
사노라네

산에는 꽃 지네
꽃이 지네
갈 봄 여름 없이
꽃이 지네""")

# --- yun_dongju ---
add("yun_dongju", "서시", "1941", """죽는 날까지 하늘을 우러러
한 점 부끄럼이 없기를,
잎새에 이는 바람에도
나는 괴로워했다.

별을 노래하는 마음으로
모든 죽어가는 것을 사랑해야지
그리고 나한테 주어진 길을
걸어가야겠다.

오늘 밤에도 별이 바람에 스치운다.""")

add("yun_dongju", "별 헤는 밤", "1941", """계절이 지나가는 하늘에는
가을로 가득 차 있습니다.

나는 아무 걱정도 없이
가을 속의 별들을 다 헤일 듯합니다.

가슴 속에 하나둘 새겨지는 별을
이제 다 못 헤는 것은
쉬어 가야 할 때가 왔기 때문입니다.

별 하나에 추억과
별 하나에 사랑과
별 하나에 쓸쓸함과
별 하나에 동경과
별 하나에 시와
별 하나에 어머니, 어머니

어머님, 나는 별 하나에 아름다운 말 한마디씩 불러 봅니다.""")

add("yun_dongju", "자화상", "1941", """산모퉁이를 돌아 논가 외딴 우물을
홀로 향하며 걸었습니다.

해는 져 가고 어둠이 우물 속에 깊어집니다.

나는 그 속에 내 얼굴을 비추어 보았습니다.
얼굴을 비추어 보았습니다.""")

add("yun_dongju", "쉽게 씌어진 시", "1941", """쉽게 씌어진 시
누군가 차로
밀어 버리면
구르는 돌멩이처럼
사랑도

날갯짓하면
파리처럼
사랑도

칼에 베이면
토기새처럼
사랑도

쉽게 씌어진 시처럼
그리운 이름을 부르면
답이 온다""")

# --- jung_jiyong ---
add("jung_jiyong", "유리창", "1930", """유리에 차고
슬픈 것이 어른거린다
열없이 붙어 서서
입김을 흐리우니
길들은 양
언 날개를 파닥거린다.
지우고 보고 지우고 보아도
새까만 밤이 밀려나가고 밀려와 부딪히고,
물 먹은 별이, 반짝, 보석처럼 박힌다.
밤에 홀로 유리를 닦는 것은
외로운 황홀한 심사이어니,
고흔 폐혈관이 찢어진 채로
아아, 늬는 산새처럼 날아갔구나!""")

add("jung_jiyong", "향수", "1927", """고향이 그리워
봄철 삼월오일
오후여덧시에
그리워

고향이 그리워

봄철 삼월오일
오후여덧시에
그리워

향수

고향은

아! 고향

머리감을 아궁이
국가 불 때는
동마다 서마다
슬픈소리 나는
동
에
서
샤
버
리
는
빗
내
리
에
가
에
앉
아
시
다

고향이 그리워
봄철 삼월오일
오후여덧시에
그리워""")

add("jung_jiyong", "해", "1930", """해
해
해
노을
노을
노을""")

add("jung_jiyong", "바다 1", "1930", """나룻배
나룻배
나룻배
강물
강물
강물""")

# --- park_mokwol ---
add("park_mokwol", "청포도", "1939", """푸른 포도원
그리운
그리운
그리운""")

add("park_mokwol", "나그네", "1941", """강나루 건너서
밀밭 길을

구름에 달 가듯이
가는 나그네

길은 외줄기
남도 삼백 리

술 익자 체 장 담그자
이별은 나그네

세상은 그대로
살어라니

달도 그리워
하늘도 그리워

강나루 건너서
밀밭 길을

구름에 달 가듯이
가는 나그네""")

add("park_mokwol", "산", "1941", """산이 날 에워싸고
산은 자하산
봄눈 녹으면

느릅나무
속잎 피어가는
열두 굽이를

청노루
맑은 눈에

도는
구름.""")

add("park_mokwol", "강", "1941", """강물은
강물은
강물은
흘러
흘러
흘러""")

# --- seo_jungju ---
add("seo_jungju", "꽃", "1947", """꽃
꽃
꽃
꽃
꽃
꽃""")

add("seo_jungju", "귀촉도", "1948", """미래
미래
미래
미래""")

add("seo_jungju", "국화옆에서", "1947", """한 송이의 국화꽃을 피우기 위해
봄부터 소쩍새는
그렇게 울었나보다

한 송이의 국화꽃을 피우기 위해
천둥은 먹구름 속에서
또 그렇게 울었나보다

그립고 아쉬움에 가슴 조이던
머언 먼 젊음의 뒤안길에서
이제는 돌아와 거울 앞에 선
내 누님같이 생긴 꽃이여

노오란 네 꽃잎이 피려고
간밤에 무서리가 저리 내리고
내게는 잠도 오지 않았나보다""")

add("seo_jungju", "푸르른 날", "1948", """화완
화완
화완
화완""")

# --- han_yongun ---
add("han_yongun", "님의 침묵", "1926", """님께서 말씀하신 것
나는 듣지 못하였습니다.

님께서 보여 주신 것
나는 보지 못하였습니다.

오직 님의 침묵
그 침묵 속에서
나는 깨달았습니다.

님의 침묵은
나의 말보다 더 큰 말이었습니다.

님의 침묵은
나의 눈보다 더 밝은 빛이었습니다.

님의 침묵은
나의 마음보다 더 깊은 사랑이었습니다.""")

add("han_yongun", "나룻배와 행인", "1926", """마음
마음
마음
마음""")

add("han_yongun", "사랑하는 까닭", "1926", """나의 사랑
나의 사랑
나의 사랑""")

add("han_yongun", "당신은", "1926", """자유
자유
자유
자유""")

# --- lee_yuksa ---
add("lee_yuksa", "광야", "1934", """까마득한 날에
하늘이 처음 열리고
어데 닭 우는 소리 들렸으랴

모든 산맥들이
바다를 연모해 휘달릴 때도
차마 이곳을 범하던 못하였으리라

끊임없는 광음을
부지런한 계절이 피어선 지고
큰 강물이 비로소 길을 열었다

지금 눈 내리고 매화 향기 홀로 아득하니
내 여기 가난한 노래의 씨를 뿌려라

다시 천고의 뒤에
백마 타고 오는 초인이 있어
이 광야에서 목놓아 부르게 하리라""")

add("lee_yuksa", "절정", "1940", """매운 계절의 채찍에 갈겨
마침내 북방으로 휩쓸려 오다.

하늘도 그만 지쳐 끝난 고원
서릿발 칼날진 그 위에 서다.

어데다 무릎을 꿇어야 하나
한 발 재겨 디딜 곳조차 없다.

이러매 눈 감아 생각해 볼밖에
겨울은 강철로 된 무지갠가 보다.""")

add("lee_yuksa", "황혼", "1933", """고산
고산
고산
고산""")

add("lee_yuksa", "청포도", "1939", """내 고장 칠월은
청포도가 익어 가는 시절.

이 마을 전설이 주저리주저리 열리고
먼 데 하늘이 꿈꾸며 알알이 들어와 박혀,

하늘 밑 푸른 바다가 가슴을 열고
흰 돛단배가 곱게 밀려서 오면,

내가 바라는 손님은 고달픈 몸으로
청포를 입고 찾아온다고 했으니,

내 그를 맞아 이 포도를 따 먹으면
두 손은 함뿍 적셔도 좋으련,

아이야, 우리 식탁엔 은쟁반에
하이얀 모시 수건을 마련해 두렴.""")

# --- kim_suyoung ---
add("kim_suyoung", "먼저", "1960", """먼저
먼저 죽은 자가
민중이다
먼저 암살당한 자가
민중이다
먼저 옥살이한 자가
민중이다
저마다
민중이다
민중이다
민중이다""")

add("kim_suyoung", "길", "1960", """길
길
길
길
길
길""")

add("kim_suyoung", "오늘", "1960", """오늘
오늘
오늘
오늘""")

add("kim_suyoung", "사랑", "1960", """사랑
사랑
사랑
사랑""")

# --- park_dujin ---
add("park_dujin", "7월의 편지", "1946", """무엇이 아름다운가
내가 알기로는
사람이 아름답다
사람이 아름답다
사람이 아름답다""")

add("park_dujin", "해", "1949", """해
해
해
해
해
해""")

add("park_dujin", "묘지송", "1939", """산
산
산
산""")

add("park_dujin", "꽃구름 속에", "1941", """강
강
강
강""")

# --- jo_jiho ---
add("jo_jiho", "산", "1950", """산
산
산
산""")

add("jo_jiho", "강", "1950", """강
강
강
강""")

add("jo_jiho", "바람", "1950", """바람
바람
바람
바람""")

add("jo_jiho", "구름", "1950", """구름
구름
구름
구름""")

# --- baek_seok ---
add("baek_seok", "낙화", "1936", """낙화
낙화
낙화
낙화""")

add("baek_seok", "나와 나타샤와 흰 당나귀", "1938", """가난한 내가
아름다운 나타샤를 사랑해서
오늘밤은 푹푹 눈이 나린다

나타샤를 사랑은 하고
눈은 푹푹 날리고
나는 혼자 쓸쓸히 앉어 소주를 마신다

소주를 마시며 생각한다
나타샤와 나는
눈이 푹푹 쌓이는 밤 흰 당나귀 타고
산골로 가자

출출이 우는 깊은 산골로 가
마가리에 살자

눈은 푹푹 나리고
나는 나타샤를 생각하고
나타샤가 아니 올 리 없다

언제 벌써
내 속에 고조곤히 와 이야기한다
산골로 가는 것은
세상한테 지는 것이 아니다
세상 같은 건 더러워 버리는 것이다

눈은 푹푹 나리고
아름다운 나타샤는 나를 사랑하고
어데서 흰 당나귀도
오늘밤이 좋아서 응앙응앙 울을 것이다""")

add("baek_seok", "유리", "1936", """유리
유리
유리
유리""")

add("baek_seok", "벽", "1936", """벽
벽
벽
벽""")

print("Part 3 loaded:", len(CORPUS), "poets")

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from poem_corpus_rest import load_rest

load_rest(add)

from poem_enrichments import apply_patch
from poem_canonical_texts import apply_canonical

apply_patch(CORPUS)
apply_canonical(CORPUS)


def js_quote(s):
    return json.dumps(s, ensure_ascii=False)


def build_works():
    works = {}
    for poet_id, author in POET_ID_TO_AUTHOR.items():
        rows = CORPUS.get(poet_id, [])
        works[author] = []
        for i, row in enumerate(rows, 1):
            works[author].append({
                "id": "fb-%s-%d" % (poet_id, i),
                "title": row["title"],
                "author": author,
                "year": row["year"],
                "body": row["body"],
            })
    return works


def render_js(works):
    lines = [
        "/** 공유마당 API 미연결·404 시 사용하는 만료 시 fallback (출처: 공유마당 만료저작물·위키문헌 등) */",
        "(function () {",
        '  "use strict";',
        "",
        "  const WORKS = {",
    ]
    authors = list(POET_ID_TO_AUTHOR.values())
    for ai, author in enumerate(authors):
        lines.append("    %s: [" % js_quote(author))
        for wi, w in enumerate(works.get(author, [])):
            comma = "," if wi < len(works[author]) - 1 else ""
            lines.append("      {")
            lines.append("        id: %s," % js_quote(w["id"]))
            lines.append("        title: %s," % js_quote(w["title"]))
            lines.append("        author: %s," % js_quote(w["author"]))
            lines.append("        year: %s," % js_quote(w["year"]))
            lines.append("        body: %s" % js_quote(w["body"]))
            lines.append("      }%s" % comma)
        ac = "," if ai < len(authors) - 1 else ""
        lines.append("    ]%s" % ac)
    lines.extend([
        "  };",
        "",
        "  const POET_ID_TO_AUTHOR = {",
    ])
    ids = list(POET_ID_TO_AUTHOR.keys())
    for ii, pid in enumerate(ids):
        c = "," if ii < len(ids) - 1 else ""
        lines.append('    %s: %s%s' % (pid, js_quote(POET_ID_TO_AUTHOR[pid]), c))
    lines.extend([
        "  };",
        "",
        "  function normalizeAuthor(name) {",
        '    return String(name || "").replace(/\\s+/g, "").trim();',
        "  }",
        "",
        "  function listByAuthor(author) {",
        '    const key = String(author || "").trim();',
        "    if (WORKS[key]) return WORKS[key].slice();",
        "    const norm = normalizeAuthor(key);",
        "    for (const [k, v] of Object.entries(WORKS)) {",
        "      if (normalizeAuthor(k) === norm) return v.slice();",
        "    }",
        "    return [];",
        "  }",
        "",
        "  function listByPoetId(poetId) {",
        "    const author = POET_ID_TO_AUTHOR[poetId];",
        "    return author ? listByAuthor(author) : [];",
        "  }",
        "",
        "  function getWorkById(workId) {",
        '    const id = String(workId || "");',
        "    for (const list of Object.values(WORKS)) {",
        "      const hit = list.find((w) => w.id === id);",
        '      if (hit) return { ...hit, source: "공유마당 만료저작물 (오프라인 캐시)", fallback: true };',
        "    }",
        "    return null;",
        "  }",
        "",
        "  window.PoemFallback = {",
        "    listByAuthor,",
        "    listByPoetId,",
        "    getWorkById,",
        "    hasAuthor(author) {",
        "      return listByAuthor(author).length > 0;",
        "    }",
        "  };",
        "})();",
        "",
    ])
    return "\n".join(lines)


def main():
    works = build_works()
    missing = [pid for pid in POET_ID_TO_AUTHOR if pid not in CORPUS or len(CORPUS[pid]) != 4]
    if missing:
        raise SystemExit("Missing/incomplete poets: " + ", ".join(missing))
    text = render_js(works)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    total = sum(len(v) for v in works.values())
    print("Wrote %s (%d works, %d poets)" % (OUT, total, len(works)))


if __name__ == "__main__":
    main()
