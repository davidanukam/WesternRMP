import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseTeacherSearchResponse } from "../utils/api.js";
import { convertProfessorName, encodeToBase64 } from "../utils/inputfiltering.js";
import { departmentIsCloseMatch, filterProfessorResults } from "../utils/outputfiltering.js";

const professorNode = {
    firstName: "Katherine",
    lastName: "Linton",
    department: "Anthropology",
    legacyId: 123,
    avgRatingRounded: 4.2
};

test("normalizes Western's initial and surname format", () => {
    assert.equal(convertProfessorName("K. Linton"), "Linton K");
    assert.equal(convertProfessorName("  Katherine   Linton  "), "Katherine Linton");
    assert.equal(encodeToBase64("1491"), "U2Nob29sLTE0OTE=");
});

test("matches a professor by initial, surname, and department", () => {
    const edges = [
        { node: { ...professorNode, department: "History" } },
        { node: professorNode }
    ];

    assert.deepEqual(filterProfessorResults(edges, "Linton K", "Anthropology"), edges[1]);
    assert.equal(departmentIsCloseMatch("Computer Science", "Science"), true);
    assert.equal(departmentIsCloseMatch("History", "Chemistry"), false);
});

test("classifies malformed, failed, empty, and successful API responses", () => {
    assert.deepEqual(parseTeacherSearchResponse(null, "Linton K", "Anthropology"), {
        ok: false,
        code: "invalid_response"
    });
    assert.deepEqual(parseTeacherSearchResponse({ errors: [{ message: "Nope" }] }, "Linton K", "Anthropology"), {
        ok: false,
        code: "api_error"
    });
    assert.deepEqual(parseTeacherSearchResponse({
        data: { newSearch: { teachers: { edges: [] } } }
    }, "Linton K", "Anthropology"), {
        ok: false,
        code: "not_found"
    });

    const result = parseTeacherSearchResponse({
        data: { newSearch: { teachers: { edges: [{ node: professorNode }] } } }
    }, "Linton K", "Anthropology");
    assert.equal(result.ok, true);
    assert.deepEqual(result.professor.node, professorNode);
});

test("keeps remote strings as data and never uses HTML injection sinks", async () => {
    const maliciousComment = `<img src=x onerror="alert(1)">`;
    const payload = {
        data: {
            newSearch: {
                teachers: {
                    edges: [{
                        node: {
                            ...professorNode,
                            mostUsefulRating: { comment: maliciousComment }
                        }
                    }]
                }
            }
        }
    };

    const result = parseTeacherSearchResponse(payload, "Linton K", "Anthropology");
    assert.equal(result.professor.node.mostUsefulRating.comment, maliciousComment);

    const contentScript = await readFile(new URL("../content.js", import.meta.url), "utf8");
    assert.equal(contentScript.includes(".innerHTML"), false);
    assert.match(contentScript, /textContent/);
    assert.match(contentScript, /noopener noreferrer/);
});

test("release manifests request only the required hosts and Firefox data consent", async () => {
    const chromeManifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
    const firefoxManifest = JSON.parse(await readFile(new URL("../manifest.firefox.json", import.meta.url), "utf8"));

    assert.deepEqual(chromeManifest.host_permissions, [
        "https://www.ratemyprofessors.com/*"
    ]);
    assert.equal(chromeManifest.permissions, undefined);
    assert.deepEqual(
        firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required,
        ["websiteContent"]
    );
    assert.match(firefoxManifest.browser_specific_settings.gecko.id, /^\{[0-9a-f-]{36}\}$/);
});
