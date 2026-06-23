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

  async function getPosts() {
    const supabase = getClient();
    if (!supabase) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }

    return supabase
      .from("posts")
      .select("id, author_name, title, content, image_url, latitude, longitude, created_at")
      .order("created_at", { ascending: false });
  }

  async function getPost(postId) {
    const supabase = getClient();
    if (!supabase) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }

    return supabase
      .from("posts")
      .select("id, user_id, author_name, title, content, image_url, latitude, longitude, created_at")
      .eq("id", postId)
      .maybeSingle();
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

    return supabase
      .from("posts")
      .insert({
        user_id: session.user.id,
        author_name: authorName,
        title,
        content,
        image_url: imageUrl,
        latitude: latitude ?? null,
        longitude: longitude ?? null
      })
      .select()
      .single();
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
        listEl.innerHTML = `<p class="auth-message error">${escapeHtml(error.message)}</p>`;
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
          <p class="board-card-meta">${escapeHtml(post.author_name)} · ${formatDate(post.created_at)}</p>
          <p class="board-card-preview">${escapeHtml(post.content.slice(0, 120))}${post.content.length > 120 ? "..." : ""}</p>
          <div class="board-card-tags">
            ${post.image_url ? '<span class="board-tag">Image</span>' : ""}
            ${post.latitude != null ? '<span class="board-tag">Location</span>' : ""}
          </div>
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

      detailEl.innerHTML = `
        <h2>${escapeHtml(data.title)}</h2>
        <p class="board-card-meta">${escapeHtml(data.author_name)} · ${formatDate(data.created_at)}</p>
        <p class="post-content">${escapeHtml(data.content).replace(/\n/g, "<br>")}</p>
        ${data.image_url ? `<img class="post-image" src="${escapeHtml(data.image_url)}" alt="Post image">` : ""}
        ${
          data.latitude != null && data.longitude != null
            ? `<div id="post-detail-map" class="map-container"></div>
               <p class="profile-meta">Location: ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}</p>`
            : ""
        }
      `;

      if (data.latitude != null && data.longitude != null) {
        showMap("post-detail-map", data.latitude, data.longitude, false);
      }
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
        msgEl.textContent = error.message;
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
