import { filterProfessorResults } from "./outputfiltering.js";

export const TEACHER_SEARCH_QUERY = `query NewSearchTeachersQuery($query: TeacherSearchQuery!) {
    newSearch {
        teachers(query: $query) {
            edges {
                node {
                    legacyId
                    firstName
                    lastName
                    avgRatingRounded
                    numRatings
                    wouldTakeAgainPercentRounded
                    teacherRatingTags {
                        tagCount
                        tagName
                    }
                    mostUsefulRating {
                        class
                        comment
                        date
                        qualityRating
                    }
                    avgDifficultyRounded
                    department
                }
            }
        }
    }
}`;

export function parseTeacherSearchResponse(payload, professorName, targetDepartment) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { ok: false, code: "invalid_response" };
    }

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        return { ok: false, code: "api_error" };
    }

    const edges = payload.data?.newSearch?.teachers?.edges;
    if (!Array.isArray(edges)) {
        return { ok: false, code: "invalid_response" };
    }

    const validEdges = edges.filter((edge) => edge?.node && typeof edge.node === "object");
    if (validEdges.length === 0) {
        return { ok: false, code: "not_found" };
    }

    const professor = filterProfessorResults(validEdges, professorName, targetDepartment);
    return professor
        ? { ok: true, professor }
        : { ok: false, code: "not_found" };
}
