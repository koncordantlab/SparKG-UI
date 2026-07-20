import base64
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()

EDU_DIR = Path(__file__).parent.parent.parent / "Education"

RESOURCES = [
    # ── Community-based ──────────────────────────────────────────────────────
    {
        "id": "infographics",
        "title": "Drug Prevention Infographics",
        "description": "12 informational one-pagers on the most frequently used substances, designed for community distribution.",
        "category": "Community",
        "file": "Community-based educational materials/Infographics.pdf",
        "type": "pdf",
    },
    {
        "id": "social-media",
        "title": "Social Media Campaign Topics",
        "description": "16 video concepts for Instagram/TikTok outreach targeting young adult substance use prevention.",
        "category": "Community",
        "file": "Community-based educational materials/Social Media Campaign Topics.pdf",
        "type": "pdf",
    },
    {
        "id": "billboard",
        "title": "Billboard Campaign",
        "description": "Proposed billboard campaign designs for community-level substance use prevention outreach.",
        "category": "Community",
        "file": "Community-based educational materials/Billboard campaign.pdf",
        "type": "pdf",
    },
    {
        "id": "dod-pamphlet",
        "title": "DoD Resource Pamphlet",
        "description": "Sample local substance-abuse resource brochure for community members.",
        "category": "Community",
        "file": "Community-based educational materials/Dod Pamphlet .pdf",
        "type": "pdf",
    },
    # ── School-based ─────────────────────────────────────────────────────────
    {
        "id": "instructor-guide",
        "title": "Instructor Guide",
        "description": "Complete instructor overview and implementation guide for the 16-lesson curriculum.",
        "category": "School",
        "file": "School-based educational materials/Instructor Guide (READ FIRST).pdf",
        "type": "pdf",
    },
    {
        "id": "teacher-script",
        "title": "Teacher Script",
        "description": "Full teacher script with talking points and facilitation notes for all lessons.",
        "category": "School",
        "file": "School-based educational materials/Teacher Script.pdf",
        "type": "pdf",
    },
    {
        "id": "curriculum-unit",
        "title": "Career Exploration Drug Prevention Unit",
        "description": "Full curriculum unit integrating drug prevention into career exploration and SEL blocks.",
        "category": "School",
        "file": "School-based educational materials/SPAR-KG Career Exploration Drug Prevention Unit.pdf",
        "type": "pdf",
    },
    {
        "id": "guardian-letter",
        "title": "Guardian Information Letter",
        "description": "Parent/guardian communication letter introducing the SPAR-KG prevention unit.",
        "category": "School",
        "file": "School-based educational materials/Guardian Information Letter (SPAR-KG Unit).pdf",
        "type": "pdf",
    },
    {
        "id": "decision-making",
        "title": "Decision-Making Scenarios",
        "description": "Interactive scenarios for students to apply refusal and coping skills.",
        "category": "School",
        "file": "School-based educational materials/Put It to Practice Decision-Making Scenarios.pdf",
        "type": "pdf",
    },
    {
        "id": "role-play",
        "title": "Role Play — Refusal & Coping Skills",
        "description": "Role play activities applying refusal and coping strategies to real-life substance pressure.",
        "category": "School",
        "file": "School-based educational materials/Role Play and Reflect Applying Refusal and Coping Skills.pdf",
        "type": "pdf",
    },
    {
        "id": "think-pair-share",
        "title": "Think-Pair-Share Reflections",
        "description": "Guided reflection activity for group discussion on substance use influences.",
        "category": "School",
        "file": "School-based educational materials/Think-Pair-Share Substance Use Reflections.pdf",
        "type": "pdf",
    },
    {
        "id": "storyboard",
        "title": "Storyboard — Navigating Substance Pressure",
        "description": "Visual storyboard illustrating peer pressure scenarios and refusal strategies.",
        "category": "School",
        "file": "School-based educational materials/Storyboard Navigating Substance Pressure.png",
        "type": "image",
    },
    {
        "id": "psa-challenge",
        "title": "Visual PSA Design Challenge",
        "description": "Student creative activity designing public service announcements about drug prevention.",
        "category": "School",
        "file": "School-based educational materials/Visual PSA Design Challenge.png",
        "type": "image",
    },
    *[
        {
            "id": f"handout-{n}",
            "title": f"Student Handout — Lesson {n}",
            "description": f"Student handout for lesson {n} of the 16-lesson prevention curriculum.",
            "category": "Handouts",
            "file": f"School-based educational materials/Student Handout Lesson {n}.pdf",
            "type": "pdf",
        }
        for n in [1, 2, 3, 4, 5, 7, 8, 9, 10, 14, 15, 16]
    ],
    {
        "id": "handout-11-12",
        "title": "Student Handout — Lessons 11 & 12",
        "description": "Student handout covering lessons 11 and 12.",
        "category": "Handouts",
        "file": "School-based educational materials/Student Handout Lesson 11 & 12.pdf",
        "type": "pdf",
    },
    {
        "id": "handout-13",
        "title": "Student Handout — Lesson 13",
        "description": "Visual student handout for lesson 13.",
        "category": "Handouts",
        "file": "School-based educational materials/Student Handout Lesson 13.png",
        "type": "image",
    },
]


def _render_thumbnail(file_path: Path, resource_type: str) -> str | None:
    try:
        if resource_type == "image":
            from PIL import Image
            import io
            img = Image.open(file_path)
            img.thumbnail((400, 300))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        else:
            import fitz
            doc = fitz.open(str(file_path))
            page = doc[0]
            mat = fitz.Matrix(1.5, 1.5)
            pix = page.get_pixmap(matrix=mat)
            return "data:image/png;base64," + base64.b64encode(pix.tobytes("png")).decode()
    except Exception:
        return None


# Pre-generate thumbnails at startup
_thumbnails: dict[str, str | None] = {}

def _load_thumbnails():
    for r in RESOURCES:
        path = EDU_DIR / r["file"]
        if path.exists():
            _thumbnails[r["id"]] = _render_thumbnail(path, r["type"])
        else:
            _thumbnails[r["id"]] = None

_load_thumbnails()


@router.get("/resources")
def get_resources(category: str = ""):
    result = []
    for r in RESOURCES:
        if category and r["category"].lower() != category.lower():
            continue
        result.append({
            **r,
            "thumbnail": _thumbnails.get(r["id"]),
            "download_url": f"/education-files/{r['file']}",
        })
    return {
        "total": len(result),
        "categories": list(dict.fromkeys(r["category"] for r in RESOURCES)),
        "resources": result,
    }
