import { AUTH_TOKEN, GRAPHQL_URL, REQUEST_TIMEOUT_MS, UWO_SCHOOL_ID } from "./constants.js";
import { parseTeacherSearchResponse, TEACHER_SEARCH_QUERY } from "./utils/api.js";
import { convertProfessorName, encodeToBase64 } from "./utils/inputfiltering.js";

const ERROR_MESSAGES = {
    api_error: "RateMyProfessors could not complete the search.",
    http_error: "RateMyProfessors is temporarily unavailable.",
    invalid_response: "RateMyProfessors returned an unexpected response.",
    network_error: "Could not connect to RateMyProfessors.",
    not_found: "Professor not found.",
    timeout: "The RateMyProfessors request timed out."
};

function failure(code, details = {}) {
    return {
        success: false,
        code,
        error: ERROR_MESSAGES[code] ?? "Unable to search for this professor.",
        retryable: code !== "not_found",
        ...details
    };
}

async function searchProfessor(professorName, targetDepartment) {
    const convertedName = convertProfessorName(professorName);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(GRAPHQL_URL, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Authorization": AUTH_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                query: TEACHER_SEARCH_QUERY,
                variables: {
                    query: {
                        text: convertedName,
                        schoolID: encodeToBase64(UWO_SCHOOL_ID)
                    }
                }
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            return failure("http_error", { status: response.status });
        }

        let payload;
        try {
            payload = await response.json();
        } catch {
            return failure("invalid_response");
        }

        const result = parseTeacherSearchResponse(payload, convertedName, targetDepartment);
        if (!result.ok) {
            return failure(result.code);
        }

        return { success: true, professor: result.professor };
    } catch (error) {
        return failure(error?.name === "AbortError" ? "timeout" : "network_error");
    } finally {
        clearTimeout(timeoutId);
    }
}

function normalizeText(value, maxLength) {
    return typeof value === "string"
        ? value.trim().slice(0, maxLength)
        : "";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.action !== "searchProfessor") {
        return false;
    }

    const professorName = normalizeText(message.professorName, 120);
    const department = normalizeText(message.department, 120);

    if (!professorName) {
        sendResponse(failure("invalid_response", {
            error: "Professor name is required.",
            retryable: false
        }));
        return false;
    }

    searchProfessor(professorName, department).then(sendResponse);
    return true;
});
