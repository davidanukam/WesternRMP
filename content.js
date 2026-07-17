(() => {
    "use strict";

    const TABLE_SELECTOR = ".table.table-condensed.table-hover";
    const SUBJECT_SELECTOR = "select#Subject.form-control";
    const MAX_CONCURRENT_REQUESTS = 4;
    const SCAN_DEBOUNCE_MS = 150;
    const TOOLTIP_HIDE_DELAY_MS = 250;

    const resultCache = new Map();
    const inFlightRequests = new Map();
    const processedTextNodes = new WeakSet();
    const hideTimers = new WeakMap();
    const requestQueue = [];
    let activeRequests = 0;
    let scanTimer;
    let tooltipSequence = 0;

    function injectStyles() {
        if (document.getElementById("westernrmp-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "westernrmp-styles";
        style.textContent = `
            .professor-name-wrapper {
                border-bottom: 1px dotted currentColor;
                cursor: pointer;
                display: inline;
                outline-offset: 3px;
            }
            .professor-name-wrapper:focus-visible {
                outline: 2px solid #075985;
            }
            .rating-indicator {
                font-size: 0.9em;
                font-weight: 700;
            }
            .professor-tooltip {
                background: #fff;
                border: 1px solid #94a3b8;
                border-radius: 6px;
                box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
                color: #1f2937;
                font-size: 14px;
                line-height: 1.4;
                max-height: min(70vh, 500px);
                max-width: calc(100vw - 16px);
                overflow: auto;
                padding: 12px;
                position: fixed;
                text-align: left;
                width: 350px;
                z-index: 2147483647;
                cursor: default;
            }
            .professor-tooltip[hidden] {
                display: none;
            }
            .professor-tooltip h3,
            .professor-tooltip h4,
            .professor-tooltip p {
                margin: 0;
            }
            .professor-tooltip-header {
                border-bottom: 1px solid #e2e8f0;
                margin-bottom: 8px;
                padding-bottom: 8px;
            }
            .professor-tooltip-header h3 {
                font-size: 16px;
            }
            .professor-tooltip-department {
                color: #475569;
                margin-top: 4px !important;
            }
            .professor-tooltip-stats {
                display: grid;
                gap: 4px 16px;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .professor-tooltip-highlight,
            .professor-tooltip h4 {
                color: #075985;
                font-weight: 700;
            }
            .professor-tooltip-section {
                border-top: 1px solid #e2e8f0;
                margin-top: 10px;
                padding-top: 8px;
            }
            .professor-tooltip h4 {
                border-bottom: 1px solid #e2e8f0;
                font-size: 15px;
                margin-bottom: 8px;
                padding-bottom: 4px;
            }
            .professor-tooltip-footer {
                font-size: 12px;
                margin-top: 10px;
                text-align: right;
            }
            .professor-tooltip a {
                color: #075985;
                cursor: pointer;
                text-decoration: underline;
            }
            .westernrmp-retry {
                background: none;
                border: 0;
                color: #9f1239;
                cursor: pointer;
                font: inherit;
                font-size: 0.85em;
                padding: 0;
                text-decoration: underline;
            }
            @media (max-width: 420px) {
                .professor-tooltip {
                    width: calc(100vw - 16px);
                }
                .professor-tooltip-stats {
                    grid-template-columns: 1fr;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function extractDepartment() {
        const selectElement = document.querySelector(SUBJECT_SELECTOR);
        return selectElement?.selectedOptions?.[0]?.textContent?.trim() ?? "";
    }

    function extractProfessorEntries(cell) {
        return Array.from(cell.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => ({ name: node.textContent.trim(), node }))
            .filter((entry) => entry.name.length > 0);
    }

    function cacheKey(professorName, department) {
        return `${professorName.toLocaleLowerCase()}|${department.toLocaleLowerCase()}`;
    }

    function drainRequestQueue() {
        while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
            const { task, resolve, reject } = requestQueue.shift();
            activeRequests += 1;

            Promise.resolve()
                .then(task)
                .then(resolve, reject)
                .finally(() => {
                    activeRequests -= 1;
                    drainRequestQueue();
                });
        }
    }

    function scheduleRequest(task) {
        return new Promise((resolve, reject) => {
            requestQueue.push({ task, resolve, reject });
            drainRequestQueue();
        });
    }

    function sendProfessorRequest(professorName, department) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: "searchProfessor",
                professorName,
                department
            }, (response) => {
                if (chrome.runtime.lastError) {
                    const error = new Error(chrome.runtime.lastError.message);
                    error.code = "runtime_error";
                    error.retryable = true;
                    reject(error);
                    return;
                }

                if (response?.success && response.professor?.node) {
                    resolve(response.professor.node);
                    return;
                }

                const error = new Error(response?.error || "Unable to search for this professor.");
                error.code = response?.code || "invalid_response";
                error.retryable = response?.retryable !== false;
                reject(error);
            });
        });
    }

    function getProfessorData(professorName, department) {
        const key = cacheKey(professorName, department);
        if (resultCache.has(key)) {
            return Promise.resolve(resultCache.get(key));
        }

        if (inFlightRequests.has(key)) {
            return inFlightRequests.get(key);
        }

        const request = scheduleRequest(() => sendProfessorRequest(professorName, department))
            .then((professor) => {
                resultCache.set(key, professor);
                return professor;
            })
            .finally(() => {
                inFlightRequests.delete(key);
            });

        inFlightRequests.set(key, request);
        return request;
    }

    function formatNumber(value, digits = 1) {
        const number = Number(value);
        return Number.isFinite(number) ? number.toFixed(digits) : "N/A";
    }

    function getRatingColor(value) {
        const rating = Number(value);
        if (!Number.isFinite(rating)) return "#475569";
        if (rating >= 4.5) return "#166534";
        if (rating >= 3.5) return "#3f6212";
        if (rating >= 2.5) return "#854d0e";
        if (rating >= 1.5) return "#9a3412";
        return "#b91c1c";
    }

    function appendLabelValue(container, label, value, valueClass) {
        const paragraph = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        paragraph.append(strong);

        const valueElement = document.createElement("span");
        valueElement.textContent = value;
        if (valueClass) {
            valueElement.className = valueClass;
        }
        paragraph.append(valueElement);
        container.append(paragraph);
    }

    function buildTooltip(data, fallbackDepartment) {
        const tooltip = document.createElement("div");
        const tooltipId = `westernrmp-tooltip-${++tooltipSequence}`;
        tooltip.id = tooltipId;
        tooltip.className = "professor-tooltip";
        tooltip.hidden = true;
        tooltip.setAttribute("role", "dialog");
        tooltip.setAttribute("aria-label", "RateMyProfessors details");

        const header = document.createElement("div");
        header.className = "professor-tooltip-header";
        const heading = document.createElement("h3");
        const fullName = [data.firstName, data.lastName].filter((part) => typeof part === "string").join(" ").trim();
        heading.textContent = fullName || "Professor rating";
        const department = document.createElement("p");
        department.className = "professor-tooltip-department";
        department.textContent = data.department || fallbackDepartment || "Department unavailable";
        header.append(heading, department);

        const stats = document.createElement("div");
        stats.className = "professor-tooltip-stats";
        appendLabelValue(stats, "Overall", `${formatNumber(data.avgRatingRounded, 1)}/5`, "professor-tooltip-highlight");
        appendLabelValue(stats, "Difficulty", `${formatNumber(data.avgDifficultyRounded, 1)}/5`);
        const takeAgain = Number.isFinite(Number(data.wouldTakeAgainPercentRounded))
            ? `${formatNumber(data.wouldTakeAgainPercentRounded, 1)}%`
            : "N/A";
        appendLabelValue(stats, "Would take again", takeAgain);
        appendLabelValue(stats, "Total ratings", Number.isFinite(Number(data.numRatings)) ? String(data.numRatings) : "0");

        tooltip.append(header, stats);

        const tags = Array.isArray(data.teacherRatingTags)
            ? [...data.teacherRatingTags]
                .filter((tag) => typeof tag?.tagName === "string")
                .sort((a, b) => Number(b.tagCount) - Number(a.tagCount))
                .slice(0, 3)
                .map((tag) => tag.tagName.trim())
                .filter(Boolean)
            : [];
        if (tags.length > 0) {
            const tagsSection = document.createElement("div");
            tagsSection.className = "professor-tooltip-section";
            appendLabelValue(tagsSection, "Top tags", tags.join(", "));
            tooltip.append(tagsSection);
        }

        const ratingSection = document.createElement("div");
        ratingSection.className = "professor-tooltip-section";
        const ratingHeading = document.createElement("h4");
        ratingHeading.textContent = "Most Helpful Rating";
        ratingSection.append(ratingHeading);

        const rating = data.mostUsefulRating;
        if (rating && typeof rating === "object") {
            appendLabelValue(ratingSection, "Course", rating.class || "Unknown course");
            const dateValue = rating.date ? new Date(rating.date) : null;
            const formattedDate = dateValue && !Number.isNaN(dateValue.getTime())
                ? dateValue.toLocaleDateString()
                : "Unknown date";
            appendLabelValue(ratingSection, "Rating", `${formatNumber(rating.qualityRating, 1)}/5 (${formattedDate})`);
            const rawComment = typeof rating.comment === "string" ? rating.comment : "No comment provided";
            const comment = rawComment.length > 150 ? `${rawComment.slice(0, 150)}…` : rawComment;
            appendLabelValue(ratingSection, "Comment", comment);
        } else {
            const empty = document.createElement("p");
            empty.textContent = "No ratings available.";
            ratingSection.append(empty);
        }
        tooltip.append(ratingSection);

        const professorId = String(data.legacyId ?? "");
        if (/^\d+$/.test(professorId)) {
            const footer = document.createElement("div");
            footer.className = "professor-tooltip-footer";
            const link = document.createElement("a");
            link.href = `https://www.ratemyprofessors.com/professor/${professorId}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View on RateMyProfessors.com";
            footer.append(link);
            tooltip.append(footer);
        }

        return { tooltip, tooltipId };
    }

    function positionTooltip(wrapper, tooltip) {
        const margin = 8;
        const bridge = 2;
        const triggerRect = wrapper.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const left = Math.min(
            Math.max(margin, triggerRect.left + (triggerRect.width - tooltipRect.width) / 2),
            window.innerWidth - tooltipRect.width - margin
        );
        const placeAbove = triggerRect.top >= tooltipRect.height + bridge;
        const top = placeAbove
            ? triggerRect.top - tooltipRect.height - bridge
            : Math.min(triggerRect.bottom + bridge, window.innerHeight - tooltipRect.height - margin);

        tooltip.style.left = `${Math.max(margin, left)}px`;
        tooltip.style.top = `${Math.max(margin, top)}px`;
        tooltip.dataset.placement = placeAbove ? "above" : "below";
    }

    function cancelHideTooltip(wrapper) {
        const timer = hideTimers.get(wrapper);
        if (timer) {
            clearTimeout(timer);
            hideTimers.delete(wrapper);
        }
    }

    function hideTooltip(wrapper, tooltip) {
        cancelHideTooltip(wrapper);
        tooltip.hidden = true;
        wrapper.setAttribute("aria-expanded", "false");
    }

    function scheduleHideTooltip(wrapper, tooltip) {
        cancelHideTooltip(wrapper);
        hideTimers.set(wrapper, setTimeout(() => {
            hideTimers.delete(wrapper);
            hideTooltip(wrapper, tooltip);
        }, TOOLTIP_HIDE_DELAY_MS));
    }

    function showTooltip(wrapper, tooltip) {
        cancelHideTooltip(wrapper);
        document.querySelectorAll(".professor-name-wrapper[aria-expanded='true']").forEach((openWrapper) => {
            if (openWrapper !== wrapper) {
                const openTooltip = openWrapper.querySelector(".professor-tooltip");
                if (openTooltip) hideTooltip(openWrapper, openTooltip);
            }
        });
        tooltip.hidden = false;
        wrapper.setAttribute("aria-expanded", "true");
        requestAnimationFrame(() => positionTooltip(wrapper, tooltip));
    }

    function attachTooltipInteractions(wrapper, tooltip) {
        const keepOpen = () => showTooltip(wrapper, tooltip);
        const maybeHide = (event) => {
            const next = event.relatedTarget;
            if (wrapper.contains(next) || tooltip.contains(next)) {
                return;
            }
            scheduleHideTooltip(wrapper, tooltip);
        };

        wrapper.addEventListener("mouseenter", keepOpen);
        wrapper.addEventListener("mouseleave", maybeHide);
        tooltip.addEventListener("mouseenter", keepOpen);
        tooltip.addEventListener("mouseleave", maybeHide);
        wrapper.addEventListener("focus", keepOpen);
        wrapper.addEventListener("focusout", maybeHide);
        tooltip.addEventListener("focusin", keepOpen);
        tooltip.addEventListener("focusout", maybeHide);
        wrapper.addEventListener("click", (event) => {
            if (event.target.closest("a")) return;
            event.stopPropagation();
            tooltip.hidden ? showTooltip(wrapper, tooltip) : hideTooltip(wrapper, tooltip);
        });
        wrapper.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hideTooltip(wrapper, tooltip);
                wrapper.focus();
            } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                tooltip.hidden ? showTooltip(wrapper, tooltip) : hideTooltip(wrapper, tooltip);
            }
        });
    }

    function renderProfessorRating(targetNode, professorName, department, data) {
        if (!targetNode.isConnected || targetNode.parentElement?.closest(".professor-name-wrapper")) {
            return;
        }

        const wrapper = document.createElement("span");
        wrapper.className = "professor-name-wrapper";
        wrapper.dataset.professorName = professorName;
        wrapper.tabIndex = 0;
        wrapper.setAttribute("role", "button");
        wrapper.setAttribute("aria-haspopup", "dialog");
        wrapper.setAttribute("aria-expanded", "false");

        const name = document.createElement("span");
        name.textContent = professorName;
        const ratingIndicator = document.createElement("span");
        ratingIndicator.className = "rating-indicator";
        ratingIndicator.style.color = getRatingColor(data.avgRatingRounded);
        ratingIndicator.textContent = ` (${formatNumber(data.avgRatingRounded, 1)})`;

        const { tooltip, tooltipId } = buildTooltip(data, department);
        wrapper.setAttribute("aria-controls", tooltipId);
        wrapper.append(name, ratingIndicator, tooltip);
        attachTooltipInteractions(wrapper, tooltip);
        targetNode.replaceWith(wrapper);
    }

    function renderRetry(targetNode, professorName, department, error) {
        if (!targetNode.isConnected || targetNode.nextSibling?.classList?.contains("westernrmp-retry")) {
            return;
        }

        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "westernrmp-retry";
        retry.textContent = " (retry rating)";
        retry.title = error.message;
        retry.setAttribute("aria-label", `Retry rating lookup for ${professorName}`);
        retry.addEventListener("click", () => {
            retry.remove();
            processedTextNodes.delete(targetNode);
            processEntry({ name: professorName, node: targetNode }, department);
        }, { once: true });
        targetNode.after(retry);
    }

    async function processEntry(entry, department) {
        if (processedTextNodes.has(entry.node)) {
            return;
        }
        processedTextNodes.add(entry.node);

        try {
            const data = await getProfessorData(entry.name, department);
            renderProfessorRating(entry.node, entry.name, department, data);
        } catch (error) {
            if (error.code !== "not_found" && error.retryable) {
                renderRetry(entry.node, entry.name, department, error);
            }
        }
    }

    function scanPageForProfessors() {
        const department = extractDepartment();
        document.querySelectorAll(TABLE_SELECTOR).forEach((table) => {
            table.querySelectorAll("tr").forEach((row) => {
                const professorCell = row.cells?.[3];
                if (!professorCell) return;
                extractProfessorEntries(professorCell).forEach((entry) => {
                    processEntry(entry, department);
                });
            });
        });
    }

    function scheduleScan() {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(scanPageForProfessors, SCAN_DEBOUNCE_MS);
    }

    function resetEnhancements() {
        document.querySelectorAll(".professor-name-wrapper").forEach((wrapper) => {
            wrapper.replaceWith(document.createTextNode(wrapper.dataset.professorName || ""));
        });
        document.querySelectorAll(".westernrmp-retry").forEach((retry) => retry.remove());
        scheduleScan();
    }

    injectStyles();
    scanPageForProfessors();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", (event) => {
        if (event.target.matches?.(SUBJECT_SELECTOR)) {
            resetEnhancements();
        }
    });
    document.addEventListener("click", () => {
        document.querySelectorAll(".professor-name-wrapper[aria-expanded='true']").forEach((wrapper) => {
            const tooltip = wrapper.querySelector(".professor-tooltip");
            if (tooltip) hideTooltip(wrapper, tooltip);
        });
    });
    window.addEventListener("resize", scheduleScan, { passive: true });
    window.addEventListener("scroll", () => {
        document.querySelectorAll(".professor-name-wrapper[aria-expanded='true']").forEach((wrapper) => {
            const tooltip = wrapper.querySelector(".professor-tooltip");
            if (tooltip) positionTooltip(wrapper, tooltip);
        });
    }, { passive: true });
})();
