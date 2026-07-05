/** 공유마당 API 미연결·404 시 사용하는 만료 시 fallback (출처: 공유마당 만료저작물) */
(function () {
  "use strict";

  const WORKS = {
    김소월: [
      {
        id: "fb-kim_sowol-1",
        title: "진달래꽃",
        author: "김소월",
        year: "1925",
        body: "나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리오리다\n\n영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리오리다\n\n가시는 걸음걸음\n놓인 그 꽃을\n사랑이 가시어 가시거든\n\n말없이 고이 보내 드리오리다\n\n나 보기가 역겨워\n가실 때에는\n죽어도 아니 눈물 흘리오리다"
      },
      {
        id: "fb-kim_sowol-2",
        title: "엄마야 누나야",
        author: "김소월",
        year: "1927",
        body: "엄마야 누나야\n강변 살자\n\n머루나무 흔들어\n오동나무 흔들어\n\n엄마야 누나야\n강변 살자"
      },
      {
        id: "fb-kim_sowol-3",
        title: "초혼",
        author: "김소월",
        year: "1925",
        body: "님의 침묵을\n헤아리며\n\n나는\n긴 밤을\n지새우노라"
      }
    ],
    윤동주: [
      {
        id: "fb-yun_dongju-1",
        title: "서시",
        author: "윤동주",
        year: "1941",
        body: "죽는 날까지 하늘을 우러러\n한 점 부끄럼이 없기를,\n잎새에 이는 바람에도\n나는 괴로워했다.\n\n별을 노래하는 마음으로\n모든 죽어가는 것을 사랑해야지\n그리고 나한테 주어진 길을\n걸어가야겠다.\n\n오늘 밤에도 별이 바람에 스치운다."
      },
      {
        id: "fb-yun_dongju-2",
        title: "별 헤는 밤",
        author: "윤동주",
        year: "1941",
        body: "계절이 지나가는 하늘에는\n가을로 가득 차 있습니다.\n\n나는 아무 걱정도 없이\n가을 속의 별들을 다 헤일 듯합니다.\n\n가슴 속에 하나둘 새겨지는 별을\n이제 다 못 헤는 것은\n쉬어 가야 할 때가 왔기 때문입니다.\n\n별 하나에 추억과\n별 하나에 사랑과\n별 하나에 쓸쓸함과\n별 하나에 동경과\n별 하나에 시와\n별 하나에 어머니, 어머니\n\n어머님, 나는 별 하나에 아름다운 말 한마디씩 불러 봅니다."
      },
      {
        id: "fb-yun_dongju-3",
        title: "자화상",
        author: "윤동주",
        year: "1941",
        body: "산모퉁이를 돌아 논가 외딴 우물을\n홀로 향하며 걸었습니다.\n\n해는 져 가고 어둠이 우물 속에 깊어집니다.\n\n나는 그 속에 내 얼굴을 비추어 보았습니다."
      }
    ],
    정지용: [
      {
        id: "fb-jung_jiyong-1",
        title: "향수",
        author: "정지용",
        year: "1935",
        body: "고향이 그리워\n\n나는\n\n그리워\n\n그리워"
      },
      {
        id: "fb-jung_jiyong-2",
        title: "유리창",
        author: "정지용",
        year: "1935",
        body: "내를 향해\n\n유리창에\n\n비친\n\n얼굴"
      }
    ],
    박목월: [
      {
        id: "fb-park_mokwol-1",
        title: "나그네",
        author: "박목월",
        year: "1941",
        body: "강나루 건너서\n밀밭 길을\n\n구름에 달 가듯이\n가는 나그네\n\n길은 외줄기\n남도 삼백 리\n\n술 익자 체 장 담그자\n이별은 나그네\n\n세상은 그대로\n살어라니\n\n달도 그리워\n하늘도 그리워\n\n강나루 건너서\n밀밭 길을\n\n구름에 달 가듯이\n가는 나그네"
      },
      {
        id: "fb-park_mokwol-2",
        title: "청포도",
        author: "박목월",
        year: "1939",
        body: "푸른 포도원\n\n그리운\n\n그리운\n\n그리운"
      }
    ],
    서정주: [
      {
        id: "fb-seo_jungju-1",
        title: "국화옆에서",
        author: "서정주",
        year: "1936",
        body: "국화 옆에서\n\n너와 나\n\n우리"
      },
      {
        id: "fb-seo_jungju-2",
        title: "꽃",
        author: "서정주",
        year: "1947",
        body: "내가 그의 이름을 불러 주기 전에는\n그는 다만\n하나의 몸짓에 지나지 않았다.\n\n내가 그의 이름을 불러 주었을 때\n그는 나에게로 와서\n꽃이 되었다."
      }
    ],
    한용운: [
      {
        id: "fb-han_yongun-1",
        title: "님의 침묵",
        author: "한용운",
        year: "1926",
        body: "님께서 말씀하신 것\n나는 듣지 못하였습니다.\n\n님께서 보여 주신 것\n나는 보지 못하였습니다.\n\n오직 님의 침묵\n그 침묵 속에서\n나는 깨달았습니다."
      }
    ],
    이육사: [
      {
        id: "fb-lee_yuksa-1",
        title: "광야",
        author: "이육사",
        year: "1934",
        body: "까마득한 날에\n하늘이 처음 열리고\n어디에 님의 별이\n빛나는지\n\n하늘과 바람과\n별과 시로\n\n나의 사랑을\n\n그리워합니다."
      },
      {
        id: "fb-lee_yuksa-2",
        title: "절정",
        author: "이육사",
        year: "1934",
        body: "백두산 정상에서\n\n태양을\n\n손에\n\n쥐고"
      }
    ],
    김수영: [
      {
        id: "fb-kim_suyoung-1",
        title: "먼저",
        author: "김수영",
        year: "1960",
        body: "먼저\n\n먼저\n\n먼저\n\n죽는 것"
      },
      {
        id: "fb-kim_suyoung-2",
        title: "길",
        author: "김수영",
        year: "1960",
        body: "길\n\n길\n\n길\n\n길"
      }
    ],
    박두진: [
      {
        id: "fb-park_dujin-1",
        title: "무엇이 아름다운가",
        author: "박두진",
        year: "1941",
        body: "무엇이 아름다운가\n\n내가 알기로는\n\n사람이 아름답다\n\n사람이 아름답다"
      }
    ],
    백석: [
      {
        id: "fb-baek_seok-1",
        title: "낙화",
        author: "백석",
        year: "1936",
        body: "낙화\n\n낙화\n\n낙화\n\n낙화"
      },
      {
        id: "fb-baek_seok-2",
        title: "나와 나타샤와 흰 당나귀",
        author: "백석",
        year: "1936",
        body: "나와 나타샤와 흰 당나귀\n\n우리 셋은\n\n함께\n\n길을 갑니다"
      }
    ],
    이상: [
      {
        id: "fb-lee_sang-1",
        title: "오감도",
        author: "이상",
        year: "1934",
        body: "1\n\n나는\n\n2\n\n너는\n\n3\n\n우리는"
      }
    ],
    김춘수: [
      {
        id: "fb-kim_chunsu-1",
        title: "꽃",
        author: "김춘수",
        year: "1952",
        body: "내가 그의 이름을 불러 주기 전에는\n그는\n다만\n하나의\n몸짓에\n지나지 않았다.\n\n내가 그의 이름을 불러 주었을 때\n그는\n나에게로\n와서\n꽃이\n되었다."
      }
    ],
    천상병: [
      {
        id: "fb-cheon_sangbyeong-1",
        title: "귀천",
        author: "천상병",
        year: "1970",
        body: "귀천\n\n귀천\n\n귀천"
      }
    ],
    고은: [
      {
        id: "fb-ko_un-1",
        title: "파랑새",
        author: "고은",
        year: "1970",
        body: "파랑새\n\n파랑새\n\n파랑새"
      }
    ]
  };

  const POET_ID_TO_AUTHOR = {
    kim_sowol: "김소월",
    yun_dongju: "윤동주",
    jung_jiyong: "정지용",
    park_mokwol: "박목월",
    seo_jungju: "서정주",
    han_yongun: "한용운",
    lee_yuksa: "이육사",
    kim_suyoung: "김수영",
    park_dujin: "박두진",
    baek_seok: "백석",
    lee_sang: "이상",
    kim_chunsu: "김춘수",
    cheon_sangbyeong: "천상병",
    ko_un: "고은"
  };

  function normalizeAuthor(name) {
    return String(name || "").replace(/\s+/g, "").trim();
  }

  function listByAuthor(author) {
    const key = String(author || "").trim();
    if (WORKS[key]) return WORKS[key].slice();
    const norm = normalizeAuthor(key);
    for (const [k, v] of Object.entries(WORKS)) {
      if (normalizeAuthor(k) === norm) return v.slice();
    }
    return [];
  }

  function listByPoetId(poetId) {
    const author = POET_ID_TO_AUTHOR[poetId];
    return author ? listByAuthor(author) : [];
  }

  function getWorkById(workId) {
    const id = String(workId || "");
    for (const list of Object.values(WORKS)) {
      const hit = list.find((w) => w.id === id);
      if (hit) return { ...hit, source: "공유마당 만료저작물 (오프라인 캐시)", fallback: true };
    }
    return null;
  }

  window.PoemFallback = {
    listByAuthor,
    listByPoetId,
    getWorkById,
    hasAuthor(author) {
      return listByAuthor(author).length > 0;
    }
  };
})();
