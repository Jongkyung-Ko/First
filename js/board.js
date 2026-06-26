(function () {
  const BUCKET = "post-images";
  let activeMap = null;

  function getClient() {
    return window.Auth.getClient();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString();
  }

  const POST_SELECT_BASE =
    "id, user_id, author_name, title, content, image_url, latitude, longitude, created_at";
  const POST_SELECT_WITH_EMAIL = `${POST_SELECT_BASE}, author_email`;

  function isMissingAuthorEmailColumn(error) {
    return /author_email/i.test(error?.message || "");
  }

  function isPostsTableMissing(error) {
    const msg = error?.message || "";
    return (
      /relation.*posts.*does not exist/i.test(msg) ||
      /could not find the table.*posts/i.test(msg)
    );
  }

  async function queryPosts(buildQuery, withEmail = true) {
    const supabase = getClient();
    if (!supabase) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }

    const columns = withEmail ? POST_SELECT_WITH_EMAIL : POST_SELECT_BASE;
    const result = await buildQuery(supabase, columns);

    if (result.error && isMissingAuthorEmailColumn(result.error) && withEmail) {
      return buildQuery(supabase, POST_SELECT_BASE);
    }

    return result;
  }

  function formatError(error) {
    const msg = error?.message || "Unknown error";
    if (isPostsTableMissing(error)) {
      return (
        "Board database not set up. Open Supabase → SQL Editor → run supabase/setup_board.sql, then try again."
      );
    }
    if (isMissingAuthorEmailColumn(error)) {
      return (
        "Author email column missing. Run supabase/posts_author_email.sql in Supabase SQL Editor."
      );
    }
    if (/post-images|bucket|storage/i.test(msg)) {
      return (
        "Image storage not set up. Run supabase/setup_board.sql in Supabase SQL Editor, then try again."
      );
    }
    return msg;
  }

  function destroyMap() {
    if (activeMap) {
      activeMap.remove();
      activeMap = null;
    }
  }

  function showMap(containerId, lat, lng, draggable) {
    destroyMap();
    const el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    activeMap = L.map(el).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(activeMap);

    const marker = L.marker([lat, lng], { draggable: Boolean(draggable) }).addTo(
      activeMap
    );

    setTimeout(() => activeMap.invalidateSize(), 100);
    return marker;
  }

  window.addEventListener("resize", () => {
    if (activeMap) {
      setTimeout(() => activeMap.invalidateSize(), 150);
    }
  });

  async function getPosts() {
    return queryPosts((supabase, columns) =>
      supabase.from("posts").select(columns).order("created_at", { ascending: false })
    );
  }

  async function getPost(postId) {
    return queryPosts((supabase, columns) =>
      supabase.from("posts").select(columns).eq("id", postId).maybeSingle()
    );
  }

  async function uploadImage(file, userId) {
    const supabase = getClient();
    if (!supabase) {
      return { url: null, error: { message: "Supabase is not configured." } };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowed = ["jpg", "jpeg", "png", "gif", "webp"];
    if (!allowed.includes(ext)) {
      return { url: null, error: { message: "Image must be JPG, PNG, GIF, or WebP." } };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: { message: "Image must be smaller than 5 MB." } };
    }

    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (error) {
      return { url: null, error };
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  function formatListDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString();
  }

  function getAuthorId(post) {
    if (post.author_email) return post.author_email;

    const session = window.Auth.getSession();
    if (session?.user?.id === post.user_id && session.user.email) {
      return session.user.email;
    }

    return post.author_name || "—";
  }

  function canManagePost(post) {
    const session = window.Auth.getSession();
    if (!session) return false;
    return isMaster() || session.user.id === post.user_id;
  }

  function isMaster() {
    return window.Auth.isMaster(window.Auth.getSession());
  }

  async function updatePost(post, { title, content }) {
    const session = window.Auth.getSession();
    if (!session) {
      return { data: null, error: { message: "You must be signed in." } };
    }
    if (!canManagePost(post)) {
      return { data: null, error: { message: "You can only edit your own posts." } };
    }

    const supabase = getClient();
    if (!supabase) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }

    return supabase
      .from("posts")
      .update({ title, content })
      .eq("id", post.id)
      .select()
      .single();
  }

  async function deletePost(post) {
    const session = window.Auth.getSession();
    if (!session) {
      return { error: { message: "You must be signed in." } };
    }
    if (!canManagePost(post)) {
      return { error: { message: "You can only delete your own posts." } };
    }

    const supabase = getClient();
    if (!supabase) {
      return { error: { message: "Supabase is not configured." } };
    }

    return supabase.from("posts").delete().eq("id", post.id);
  }

  async function createPost({ title, content, imageFile, latitude, longitude }) {
    const session = window.Auth.getSession();
    if (!session) {
      return { data: null, error: { message: "You must be signed in to post." } };
    }

    const supabase = getClient();
    if (!supabase) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }

    let imageUrl = null;
    if (imageFile) {
      const upload = await uploadImage(imageFile, session.user.id);
      if (upload.error) {
        return { data: null, error: upload.error };
      }
      imageUrl = upload.url;
    }

    const authorName =
      session.user.user_metadata?.full_name ||
      session.user.email?.split("@")[0] ||
      "User";

    const payload = {
      user_id: session.user.id,
      author_name: authorName,
      title,
      content,
      image_url: imageUrl,
      latitude: latitude ?? null,
      longitude: longitude ?? null
    };

    let result = await supabase
      .from("posts")
      .insert({ ...payload, author_email: session.user.email || null })
      .select()
      .single();

    if (result.error && isMissingAuthorEmailColumn(result.error)) {
      result = await supabase.from("posts").insert(payload).select().single();
    }

    return result;
  }

  function renderBoardList(container, onSelectPost) {
    destroyMap();
    container.innerHTML = `
      <article class="content-panel board-panel">
        <h2>Board</h2>
        <p>Read posts from the community. Sign in to write a post.</p>
        <div id="board-list" class="board-list">
          <p class="board-loading">Loading posts...</p>
        </div>
      </article>
    `;

    getPosts().then(({ data, error }) => {
      const listEl = document.getElementById("board-list");
      if (!listEl) return;

      if (error) {
        listEl.innerHTML = `<p class="auth-message error">${escapeHtml(formatError(error))}</p>`;
        return;
      }

      if (!data?.length) {
        listEl.innerHTML = `<p class="board-empty">No posts yet. Be the first to write one!</p>`;
        return;
      }

      listEl.innerHTML = data
        .map(
          (post) => `
        <button type="button" class="board-card" data-post-id="${post.id}">
          <h3>${escapeHtml(post.title)}</h3>
          <p class="board-card-meta">${formatListDate(post.created_at)} · ID: ${escapeHtml(getAuthorId(post))}</p>
          ${
            post.image_url
              ? `<img class="board-card-thumb" src="${escapeHtml(post.image_url)}" alt="">`
              : ""
          }
        </button>
      `
        )
        .join("");

      listEl.querySelectorAll(".board-card").forEach((card) => {
        card.addEventListener("click", () => onSelectPost(card.dataset.postId));
      });
    });
  }

  function renderPostDetail(container, postId, onBack) {
    destroyMap();
    container.innerHTML = `
      <article class="content-panel board-panel">
        <button type="button" class="secondary-btn board-back-btn" id="board-back-btn">&larr; Back to board</button>
        <div id="post-detail"><p class="board-loading">Loading...</p></div>
      </article>
    `;

    document.getElementById("board-back-btn")?.addEventListener("click", onBack);

    getPost(postId).then(({ data, error }) => {
      const detailEl = document.getElementById("post-detail");
      if (!detailEl) return;

      if (error || !data) {
        detailEl.innerHTML = `<p class="auth-message error">${escapeHtml(error?.message || "Post not found.")}</p>`;
        return;
      }

      const canManage = canManagePost(data);
      detailEl.innerHTML = `
        <h2>${escapeHtml(data.title)}</h2>
        <p class="board-card-meta">${formatListDate(data.created_at)} · ID: ${escapeHtml(getAuthorId(data))}</p>
        <p class="post-content">${escapeHtml(data.content).replace(/\n/g, "<br>")}</p>
        ${data.image_url ? `<img class="post-image" src="${escapeHtml(data.image_url)}" alt="Post image">` : ""}
        ${
          data.latitude != null && data.longitude != null
            ? `<div id="post-detail-map" class="map-container"></div>
               <p class="profile-meta">Location: ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}</p>`
            : ""
        }
        ${
          canManage
            ? `<div class="post-admin-actions">
                 <button type="button" class="action-btn" id="post-edit-btn">수정</button>
                 <button type="button" class="danger-btn" id="post-delete-btn">삭제</button>
               </div>`
            : ""
        }
      `;

      if (data.latitude != null && data.longitude != null) {
        showMap("post-detail-map", data.latitude, data.longitude, false);
      }

      if (canManage) {
        document.getElementById("post-edit-btn")?.addEventListener("click", () => {
          renderEditPost(container, data, () => renderPostDetail(container, postId, onBack));
        });

        document.getElementById("post-delete-btn")?.addEventListener("click", async () => {
          const confirmed = window.confirm("이 게시글을 삭제하시겠습니까?");
          if (!confirmed) return;

          const deleteBtn = document.getElementById("post-delete-btn");
          if (deleteBtn) deleteBtn.disabled = true;

          const { error: deleteError } = await deletePost(data);
          if (deleteError) {
            if (deleteBtn) deleteBtn.disabled = false;
            alert(formatError(deleteError));
            return;
          }

          onBack();
        });
      }
    });
  }

  function renderEditPost(container, post, onSaved) {
    destroyMap();
    container.innerHTML = `
      <article class="content-panel board-panel">
        <button type="button" class="secondary-btn board-back-btn" id="edit-back-btn">&larr; 취소</button>
        <h2>게시글 수정</h2>
        <p class="board-card-meta">${formatListDate(post.created_at)} · ID: ${escapeHtml(getAuthorId(post))}</p>
        <form id="edit-post-form">
          <div class="form-group form-group-wide">
            <label for="edit-post-title">제목</label>
            <input id="edit-post-title" type="text" required maxlength="120" value="${escapeHtml(post.title)}">
          </div>
          <div class="form-group form-group-wide">
            <label for="edit-post-content">내용</label>
            <textarea id="edit-post-content" required rows="8">${escapeHtml(post.content)}</textarea>
          </div>
          <button class="action-btn" type="submit">저장</button>
        </form>
        <div id="edit-post-message" class="auth-message" hidden></div>
      </article>
    `;

    document.getElementById("edit-back-btn")?.addEventListener("click", onSaved);

    document.getElementById("edit-post-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const msgEl = document.getElementById("edit-post-message");
      const submitBtn = event.target.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      msgEl.hidden = true;

      const title = document.getElementById("edit-post-title").value.trim();
      const content = document.getElementById("edit-post-content").value.trim();

      const { error } = await updatePost(post, { title, content });
      submitBtn.disabled = false;

      if (error) {
        msgEl.textContent = formatError(error);
        msgEl.className = "auth-message error";
        msgEl.hidden = false;
        return;
      }

      msgEl.textContent = "게시글이 수정되었습니다.";
      msgEl.className = "auth-message success";
      msgEl.hidden = false;
      setTimeout(onSaved, 600);
    });
  }

  function renderNewPost(container, onSuccess) {
    destroyMap();
    const session = window.Auth.getSession();
    if (!session) {
      container.innerHTML = `
        <article class="content-panel">
          <h2>Write Post</h2>
          <p class="auth-message info">Please sign in to write a post.</p>
        </article>
      `;
      return;
    }

    container.innerHTML = `
      <article class="content-panel board-panel">
        <h2>Write Post</h2>
        <form id="new-post-form">
          <div class="form-group">
            <label for="post-title">Title</label>
            <input id="post-title" type="text" required maxlength="120" placeholder="Post title">
          </div>
          <div class="form-group form-group-wide">
            <label for="post-content">Content</label>
            <textarea id="post-content" required rows="6" placeholder="Write your post..."></textarea>
          </div>
          <div class="form-group form-group-wide">
            <label for="post-image">Image (optional)</label>
            <input id="post-image" type="file" accept="image/jpeg,image/png,image/gif,image/webp">
            <img id="post-image-preview" class="post-image-preview" hidden alt="Preview">
          </div>
          <div class="form-group form-group-wide">
            <label>Location (optional)</label>
            <button type="button" class="secondary-btn" id="use-location-btn">Use current location</button>
            <p id="location-label" class="profile-meta">No location selected</p>
            <div id="new-post-map" class="map-container" hidden></div>
          </div>
          <button class="action-btn" type="submit">Publish</button>
        </form>
        <div id="new-post-message" class="auth-message" hidden></div>
      </article>
    `;

    let selectedLat = null;
    let selectedLng = null;
    let locationMarker = null;

    const imageInput = document.getElementById("post-image");
    const preview = document.getElementById("post-image-preview");
    imageInput?.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      if (!file) {
        preview.hidden = true;
        return;
      }
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    });

    document.getElementById("use-location-btn")?.addEventListener("click", () => {
      const label = document.getElementById("location-label");
      const mapEl = document.getElementById("new-post-map");
      if (!navigator.geolocation) {
        label.textContent = "Geolocation is not supported in this browser.";
        return;
      }

      label.textContent = "Getting your location...";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          selectedLat = pos.coords.latitude;
          selectedLng = pos.coords.longitude;
          label.textContent = `Location: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
          mapEl.hidden = false;
          locationMarker = showMap("new-post-map", selectedLat, selectedLng, true);
          locationMarker?.on("dragend", () => {
            const ll = locationMarker.getLatLng();
            selectedLat = ll.lat;
            selectedLng = ll.lng;
            label.textContent = `Location: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
          });
        },
        (err) => {
          label.textContent = `Location error: ${err.message}`;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    document.getElementById("new-post-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const msgEl = document.getElementById("new-post-message");
      const submitBtn = event.target.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      msgEl.hidden = true;

      const title = document.getElementById("post-title").value.trim();
      const content = document.getElementById("post-content").value.trim();
      const imageFile = imageInput?.files?.[0] || null;

      const { data, error } = await createPost({
        title,
        content,
        imageFile,
        latitude: selectedLat,
        longitude: selectedLng
      });

      submitBtn.disabled = false;

      if (error) {
        msgEl.textContent = formatError(error);
        msgEl.className = "auth-message error";
        msgEl.hidden = false;
        return;
      }

      msgEl.textContent = "Post published!";
      msgEl.className = "auth-message success";
      msgEl.hidden = false;
      setTimeout(() => onSuccess(data.id), 800);
    });
  }

  window.Board = {
    renderBoardList,
    renderPostDetail,
    renderNewPost,
    destroyMap
  };
})();
