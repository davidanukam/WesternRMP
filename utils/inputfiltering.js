export const convertProfessorName = (professorName) => {
    if (!professorName || typeof professorName !== "string") {
        return "";
    }

    const normalizedName = professorName.trim().replace(/\s+/g, " ");
    const parts = normalizedName.split(/\.\s+/);

    if (parts.length !== 2) {
        return normalizedName;
    }

    const initial = parts[0].replace(/\./g, "");
    const lastName = parts[1];

    // return in format "Last F" (no period): found to be more accurate in searches
    return `${lastName} ${initial}`;
};

// encode a string to base64 with "School-" prefix
export function encodeToBase64(str) {
    if (!str || typeof str !== "string") {
        return "";
    }

    return btoa(`School-${str}`);
}
