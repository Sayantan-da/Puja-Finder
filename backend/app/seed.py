"""Seed data: famous Durga Puja pandals in Kolkata (demo data)."""
from datetime import datetime

from app.config import settings

PANDALS = [
    {
        "name": "Santosh Mitra Square", "locality": "Sealdah",
        "address": "Santosh Mitra Square, Sealdah, Kolkata 700009",
        "latitude": 22.5675, "longitude": 88.3723,
        "theme": "Royal Rajbari Durga Dalan", "description": "One of North Kolkata's most iconic pujos, famous for its grand illumination and traditional dalaan.",
        "opening_time": "04:00", "closing_time": "23:30",
    },
    {
        "name": "Kumartuli Park", "locality": "Kumartuli",
        "address": "Banamali Naskar Lane, Kumartuli, Kolkata 700002",
        "latitude": 22.5996, "longitude": 88.3733,
        "theme": "Tribal Art of Jharkhand", "description": "In the heart of the idol-makers' quarter, known for artistic innovation every year.",
        "opening_time": "04:00", "closing_time": "23:00",
    },
    {
        "name": "Bagbazar Sarbojanin", "locality": "Bagbazar",
        "address": "Bagbazar Street, Kolkata 700003",
        "latitude": 22.5990, "longitude": 88.3685,
        "theme": "Traditional Debi Chala", "description": "One of Kolkata's oldest sarbojanin pujos (since 1919), famous for its decked arched pandal.",
        "opening_time": "04:30", "closing_time": "23:00",
    },
    {
        "name": "Ahiritola Sarbojanin", "locality": "Ahiritola",
        "address": "Ahiritola Street, Kolkata 700005",
        "latitude": 22.5960, "longitude": 88.3660,
        "theme": "Mayapur Chandradoya Mandir replica", "description": "Famous for its sprawling theme pandal along the Ganges.",
        "opening_time": "04:00", "closing_time": "23:00",
    },
    {
        "name": "College Square", "locality": "College Street",
        "address": "College Square, Kolkata 700012",
        "latitude": 22.5740, "longitude": 88.3660,
        "theme": "Golden Temple replica by the lake", "description": "Renowned for its spectacular reflection of the illuminated pandal in the lake.",
        "opening_time": "04:00", "closing_time": "00:00",
    },
    {
        "name": "Mohammad Ali Park", "locality": "Burrabazar",
        "address": "Mohammad Ali Park, Central Avenue, Kolkata 700012",
        "latitude": 22.5810, "longitude": 88.3730,
        "theme": "Kailash Parvat", "description": "Central Kolkata's showstopper, drawing huge crowds for its grand replicas.",
        "opening_time": "04:00", "closing_time": "23:30",
    },
    {
        "name": "Suruchi Sangha", "locality": "New Alipore",
        "address": "New Alipore, Block A, Kolkata 700053",
        "latitude": 22.5200, "longitude": 88.3290,
        "theme": "Rajasthan Folk", "description": "Award-winning club famous for spectacular themed pandals and cultural programmes.",
        "opening_time": "04:00", "closing_time": "23:00",
    },
    {
        "name": "Ekdalia Evergreen Club", "locality": "Ballygunge",
        "address": "Ekdalia Place, Ballygunge, Kolkata 700019",
        "latitude": 22.5250, "longitude": 88.3660,
        "theme": "Puri Jagannath Temple", "description": "Known for life-size temple replicas and towering illumination.",
        "opening_time": "04:00", "closing_time": "23:30",
    },
    {
        "name": "Singhi Park Sarbojanin", "locality": "Ballygunge",
        "address": "Singhi Park, Ballygunge, Kolkata 700019",
        "latitude": 22.5235, "longitude": 88.3687,
        "theme": "Hampi Ruins", "description": "A South Kolkata favourite with traditional idol and grand theme pandal.",
        "opening_time": "04:00", "closing_time": "23:00",
    },
    {
        "name": "Ballygunge Cultural Association", "locality": "Ballygunge",
        "address": "Kasba Road, Ballygunge, Kolkata 700029",
        "latitude": 22.5247, "longitude": 88.3638,
        "theme": "Eco-art with sholapith", "description": "Blends tradition with contemporary art installations.",
        "opening_time": "04:30", "closing_time": "23:00",
    },
    {
        "name": "Deshapriya Park", "locality": "Kalighat",
        "address": "Deshapriya Park, Kolkata 700029",
        "latitude": 22.5178, "longitude": 88.3661,
        "theme": "Sonar Bangla", "description": "Famous for the record 88-ft Durga idol in recent memory; massive footfall.",
        "opening_time": "04:00", "closing_time": "00:00",
    },
    {
        "name": "Tridhara Sammilani", "locality": "Ballygunge",
        "address": "Tridhara Sammilani, 30/2 Gariahat Road, Kolkata 700029",
        "latitude": 22.5148, "longitude": 88.3642,
        "theme": "Terracotta Temples of Bishnupur", "description": "A trendsetter in themed pujos with an emphasis on craftsmanship.",
        "opening_time": "04:00", "closing_time": "23:30",
    },
    {
        "name": "Jodhpur Park 95 Pally", "locality": "Jodhpur Park",
        "address": "95 Pally, Jodhpur Park, Kolkata 700045",
        "latitude": 22.5120, "longitude": 88.3680,
        "theme": "Sundarbans Mangrove", "description": "Community puja beloved for detailed themes and warm hospitality.",
        "opening_time": "04:00", "closing_time": "23:00",
    },
    {
        "name": "Naktala Udayan Sangha", "locality": "Naktala",
        "address": "Naktala, Garia, Kolkata 700047",
        "latitude": 22.5020, "longitude": 88.3860,
        "theme": "Konark Sun Temple", "description": "Big-budget theme pujo of South Kolkata with spectacular lighting.",
        "opening_time": "04:00", "closing_time": "23:30",
    },
    {
        "name": "Chetla Agrani", "locality": "Chetla",
        "address": "Chetla Agrani Club, Chetla, Kolkata 700027",
        "latitude": 22.5210, "longitude": 88.3560,
        "theme": "Banaras Ghats", "description": "Riverside puja with a beautiful traditional idol and cultural nights.",
        "opening_time": "04:00", "closing_time": "23:00",
    },
    {
        "name": "Sovabazar Rajbari", "locality": "Sovabazar",
        "address": "36 Raja Nabakrishna Street, Sovabazar, Kolkata 700005",
        "latitude": 22.5975, "longitude": 88.3644,
        "theme": "300-Year-Old Aristocratic Heritage Puja",
        "description": "Started in 1757 by Raja Nabakrishna Deb in the grand open courtyard (Thakur Dalan), featuring the timeless Ekchala Durga with Daker Saaj.",
        "opening_time": "05:00", "closing_time": "23:00",
    },
    {
        "name": "Sreebhumi Sporting Club", "locality": "Lake Town",
        "address": "VIP Road, Lake Town, South Dumdum, Kolkata 700089",
        "latitude": 22.5991, "longitude": 88.4014,
        "theme": "Vatican City Basilica & Gold Ornaments",
        "description": "Famous for colossal architectural marvels, world-class light gates along VIP Road, and real gold jewelry on the deity.",
        "opening_time": "04:00", "closing_time": "01:00",
    },
    {
        "name": "FD Block Salt Lake", "locality": "Salt Lake",
        "address": "FD Block Park, Sector III, Bidhannagar, Kolkata 700098",
        "latitude": 22.5833, "longitude": 88.4124,
        "theme": "Mayan Temple & Holographic Light Spectacular",
        "description": "Salt Lake's marquee big-budget pujo with innovative themes, eco-sculptures and bustling street food carnival.",
        "opening_time": "05:00", "closing_time": "00:00",
    },
    {
        "name": "BJ Block Salt Lake", "locality": "Salt Lake",
        "address": "BJ Block Ground, Sector II, Salt Lake, Kolkata 700091",
        "latitude": 22.5888, "longitude": 88.4162,
        "theme": "Kinetic Bamboo & Eco-Craft Pavilion",
        "description": "Award-winning theme installations blending futuristic architectural forms with Bengal's traditional cane and bamboo craftsmanship.",
        "opening_time": "05:00", "closing_time": "23:30",
    },
    {
        "name": "Newtown Sarbojanin Durgotsav", "locality": "Newtown",
        "address": "City Square Ground, Action Area 1, Newtown, Kolkata 700156",
        "latitude": 22.5965, "longitude": 88.4710,
        "theme": "Smart-City Bengal & Drone Light Show",
        "description": "Newtown's flagship mega installation celebrating modern smart-city life harmonized with rich Bengali festive heritage.",
        "opening_time": "05:00", "closing_time": "00:30",
    },
]

# Durga Puja 2026: Shashthi 27 Sep 2026 → Dashami 2 Oct 2026 (approximate programme slots)
EVENTS = [
    ("Santosh Mitra Square", "Maha Shashthi Bodhon", "Traditional unveiling and bodhon rituals", "2026-09-27", "09:00", "12:00", "PUJA"),
    ("Santosh Mitra Square", "Sandhi Puja", "Auspicious Sandhi Puja with 108 lamps", "2026-09-30", "23:30", "00:30", "PUJA"),
    ("College Square", "Dhunuchi Naach Competition", "Open dhunuchi dance competition, prizes for top 3", "2026-09-29", "19:00", "22:00", "CULTURAL"),
    ("Suruchi Sangha", "Cultural Night: Rabindra Sangeet", "Evening of Rabindra Sangeet and Nazrul Geeti", "2026-09-28", "18:30", "21:30", "MUSIC"),
    ("Ekdalia Evergreen Club", "Community Bhog Distribution", "Free khichuri bhog for all visitors", "2026-09-29", "12:00", "15:00", "FOOD"),
    ("Deshapriya Park", "Sandhi Puja & 108 Diya", "Special Sandhi Puja ceremony", "2026-09-30", "23:40", "00:40", "PUJA"),
    ("Tridhara Sammilani", "Bengali Folk Music Evening", "Baul and folk performances", "2026-09-29", "18:00", "21:00", "MUSIC"),
    ("Naktala Udayan Sangha", "Grande Dashami Procession", "Immersion send-off with dhak and nasik bands", "2026-10-02", "15:00", "20:00", "PROCESSION"),
    ("Bagbazar Sarbojanin", "Kumari Puja", "Traditional kumari puja on Ashtami morning", "2026-09-29", "08:00", "10:00", "PUJA"),
    ("Chetla Agrani", "Khichuri Bhog & Cultural Evening", "Bhog at noon, cultural programme at dusk", "2026-09-29", "12:00", "21:00", "CULTURAL"),
]

# Seeded demo photos (bundled in backend/uploads/seed/)
SEED_IMAGES = [
    ("Santosh Mitra Square", "santosh-mitra-square.jpg", "Illuminated rajbari dalaan at blue hour"),
    ("Kumartuli Park", "kumartuli-park.jpg", "Tribal art theme pandal"),
    ("College Square", "college-square.jpg", "Golden pandal reflecting in the lake"),
    ("Suruchi Sangha", "suruchi-sangha.jpg", "Rajasthani folk theme with mirror work"),
    ("Ekdalia Evergreen Club", "ekdalia-evergreen.jpg", "Puri Jagannath temple replica at night"),
    ("Deshapriya Park", "deshapriya-park.jpg", "Grand illumination and festival crowd"),
]

DEMO_USERS = [
    {"name": "PujaFinder Admin", "email": "admin@pujafinder.in", "password": "Admin@123", "role": "ADMIN"},
    {"name": "Demo User", "email": "demo@pujafinder.in", "password": "User@123", "role": "USER"},
]

REVIEWS = [
    ("Santosh Mitra Square", 5, "Stunning illumination, worth the queue. Go late night on Saptami!"),
    ("Santosh Mitra Square", 4, "Beautiful dalaan but very crowded in the evening."),
    ("Kumartuli Park", 5, "The tribal art theme is breathtaking. Best theme of the year."),
    ("College Square", 5, "The lake reflection at night is magical. A must-visit."),
    ("College Square", 3, "Huge crowd, waited almost an hour. Visit on weekday mornings."),
    ("Suruchi Sangha", 4, "Rajasthani theme was detailed and colourful. Great cultural nights."),
    ("Ekdalia Evergreen Club", 5, "The Jagannath temple replica is massive. Impressive craftsmanship."),
    ("Deshapriya Park", 4, "Iconic pujo. Food stalls nearby are excellent."),
    ("Tridhara Sammilani", 5, "Bishnupur terracotta theme — intricate and gorgeous."),
    ("Sovabazar Rajbari", 5, "Unmatched regal heritage atmosphere. The Thakur Dalan is transcendent."),
    ("Sreebhumi Sporting Club", 5, "Vatican City replica is mind-blowing! Grand lighting on VIP Road."),
    ("FD Block Salt Lake", 4, "Great theme with lots of space to walk and wonderful food street."),
    ("BJ Block Salt Lake", 5, "Eco-bamboo work is outstanding artistry. Clean and well-organized."),
    ("Newtown Sarbojanin Durgotsav", 5, "Modern smart-city theme with great drone light show."),
]

CROWD_REPORTS = [
    ("Santosh Mitra Square", "HIGH", 55, "PEDESTRIAN_ONLY", "LONG_CIRCUIT", "VIP_PASS,CROWDED", "Long queue at pandal entrance"),
    ("College Square", "HIGH", 65, "CONGESTED", "MODERATE", "CROWDED,WATERLOGGED", "Heavy evening crowd around the lake"),
    ("Kumartuli Park", "MODERATE", 25, "CLEAR", "DIRECT", "SENIOR_FRIENDLY,STROLLER_OK", "Moving steadily"),
    ("Suruchi Sangha", "LOW", 10, "CLEAR", "DIRECT", "SENIOR_FRIENDLY,WHEELCHAIR_OK", "No queue right now, very smooth"),
    ("Ekdalia Evergreen Club", "MODERATE", 30, "CONGESTED", "MODERATE", "SENIOR_QUEUE,VIP_PASS", "Bhog queue is long, pandal ok"),
    ("Deshapriya Park", "HIGH", 50, "CONGESTED", "LONG_CIRCUIT", "CROWDED", "Crowded entry through barricades"),
    ("Tridhara Sammilani", "LOW", 8, "CLEAR", "DIRECT", "SENIOR_FRIENDLY", "Great time to visit"),
    ("Sovabazar Rajbari", "MODERATE", 20, "CLEAR", "DIRECT", "SENIOR_FRIENDLY", "Heritage courtyard has steady flow"),
    ("Sreebhumi Sporting Club", "HIGH", 60, "PEDESTRIAN_ONLY", "LONG_CIRCUIT", "VIP_PASS,CROWDED", "Heavy queue on VIP Road entry gate"),
    ("FD Block Salt Lake", "MODERATE", 25, "CLEAR", "MODERATE", "SENIOR_FRIENDLY", "Park queue moving comfortably"),
    ("BJ Block Salt Lake", "LOW", 12, "CLEAR", "DIRECT", "WHEELCHAIR_OK,SENIOR_FRIENDLY", "Fast moving queue"),
    ("Newtown Sarbojanin Durgotsav", "LOW", 15, "CLEAR", "DIRECT", "WHEELCHAIR_OK,STROLLER_OK", "Spacious entrance with smooth security check"),
]


CONTENT_SEED = [
    {
        "key": "what_is",
        "title": "What is Durga Puja?",
        "body": (
            "Durga Puja is Kolkata's biggest festival — five days each autumn when the city honours "
            "Goddess Durga's victory over the demon Mahishasura. UNESCO inscribed it on its list of "
            "Intangible Cultural Heritage of Humanity in 2021.\n\n"
            "For a week the city transforms: thousands of artist-built pandals (temporary pavilions), "
            "elaborate idols crafted in Kumartuli, dazzling lightwork, dhak drums, and streets alive "
            "until dawn. It is part religion, part art festival, part homecoming."
        ),
    },
    {
        "key": "five_days",
        "title": "The Five Days of Pujo",
        "body": (
            "Shashthi (6th day) — Bodhon: the Goddess is unveiled and invoked.\n"
            "Saptami (7th) — Nabapatrika snan and the first full day of rituals.\n"
            "Ashtami (8th) — the most auspicious day: pushpanjali offerings and Sandhi Puja begins.\n"
            "Navami (9th) — hom (fire ritual), bhog, and cultural nights.\n"
            "Dashami (10th) — sindoor khela, farewell processions and idol immersion."
        ),
    },
    {
        "key": "pandal_hopping",
        "title": "Pandal Hopping in Kolkata",
        "body": (
            "Pandal hopping (locally 'pujo parikrama') is the heart of the festival. North Kolkata's "
            "heritage pujos — Bagbazar, Kumartuli, Santosh Mitra Square — trade in tradition, while "
            "South Kolkata's clubs — Suruchi Sangha, Tridhara, Ekdalia Evergreen — compete with "
            "spectacular themed art.\n\n"
            "Use PujaFinder's live crowd levels to plan your route: go early for the famous ones, "
            "and let the Near-me page find the quiet gems around you."
        ),
    },
    {
        "key": "visitor_tips",
        "title": "Tips for Visitors",
        "body": (
            "• Wear comfortable shoes — you will walk kilometres every night.\n"
            "• Networks get jammed near big pandals; screenshot your route in advance.\n"
            "• Bhog (khichuri) is usually served lunch-time on Ashtami/Navami — go hungry.\n"
            "• Keep small notes for offerings and street food (try the puchka stalls!).\n"
            "• Metro runs late during Puja days — it is the fastest way across the city.\n"
            "• Most pandals open 4 AM and stay lit past midnight."
        ),
    },
]

MOMENTS_SEED = [
    ("admin@pujafinder.in", "santosh-mitra-square.jpg", "Golden hour at the rajbari dalaan ✨"),
    ("demo@pujafinder.in", "college-square.jpg", "The lake reflection everyone talks about 🪔"),
    ("demo@pujafinder.in", "ekdalia-evergreen.jpg", "Jagannath replica — jaw on the floor 😍"),
]

MOMENT_VOTES_SEED = [
    ("santosh-mitra-square.jpg", "demo@pujafinder.in", 5),
    ("santosh-mitra-square.jpg", "admin@pujafinder.in", 4),
    ("college-square.jpg", "admin@pujafinder.in", 5),
    ("college-square.jpg", "demo@pujafinder.in", 5),
    ("ekdalia-evergreen.jpg", "demo@pujafinder.in", 5),
]


def seed_extras(db) -> None:
    """Seed About-page content and demo Moments (independent of the pandal seed)."""
    from app.models.moment import Moment, MomentVote
    from app.models.site_content import ContentBlock
    from app.models.user import User

    users = {
        u.email: u
        for u in db.query(User)
        .filter(User.email.in_(["admin@pujafinder.in", "demo@pujafinder.in"]))
        .all()
    }
    admin = users.get("admin@pujafinder.in")
    demo = users.get("demo@pujafinder.in")
    demo_mode = settings.environment != "production"

    if db.query(ContentBlock).count() == 0:
        for item in CONTENT_SEED:
            db.add(ContentBlock(**item, updated_by_id=admin.id if (demo_mode and admin is not None) else None))

    if demo_mode and db.query(Moment).count() == 0 and admin is not None and demo is not None:
        for email, filename, caption in MOMENTS_SEED:
            db.add(Moment(
                user_id=users[email].id,
                image_url=f"/uploads/seed/{filename}",
                caption=caption,
            ))
        db.flush()

    if db.query(MomentVote).count() == 0 and admin is not None and demo is not None:
        by_file = {m.image_url.rsplit("/", 1)[-1]: m for m in db.query(Moment).all()}
        for filename, email, rating in MOMENT_VOTES_SEED:
            moment = by_file.get(filename)
            if moment is not None:
                db.add(MomentVote(moment_id=moment.id, user_id=users[email].id, rating=rating))

    db.commit()


def bootstrap_admin(db) -> None:
    """Create the production ADMIN account from env vars (idempotent)."""
    from app.models.user import Role, User
    from app.utils.security import hash_password

    email = (settings.admin_email or "").strip().lower()
    password = settings.admin_password or ""
    if not email or not password:
        return
    exists = db.query(User).filter(User.email == email).first()
    if exists:
        changed = False
        if exists.role != Role.ADMIN:
            exists.role = Role.ADMIN
            changed = True
        if not exists.is_active:
            exists.is_active = True
            changed = True
        if changed:
            db.commit()
            print(f"[bootstrap] promoted/activated existing user {email} to ADMIN")
        return
    db.add(User(name="Administrator", email=email,
                password_hash=hash_password(password), role=Role.ADMIN, is_active=True))
    db.commit()
    print(f"[bootstrap] created ADMIN account: {email}")


def seed_if_empty(db) -> None:
    """Populate demo data on first run (only if the DB has no pandals)."""
    from app.models.crowd_report import CrowdLevel, CrowdReport
    from app.models.event import Event, EventType
    from app.models.favorite import Favorite
    from app.models.image import Image
    from app.models.pandal import Pandal
    from app.models.review import Review
    from app.models.user import Role, User
    from app.utils.security import hash_password

    if db.query(Pandal).count() > 0:
        sync_pandals_seed(db)
        return

    # SECURITY (OWASP A07 / A01): Demo accounts are strictly isolated to development/sandbox.
    # In production, hardcoded accounts are NEVER seeded.
    demo = settings.environment in ("development", "sandbox")


    pandal_by_name: dict[str, Pandal] = {}
    for item in PANDALS:
        pandal = Pandal(**item)
        db.add(pandal)
        pandal_by_name[item["name"]] = pandal
    db.flush()

    demo_user = None
    admin_user = None
    if demo:
        users: dict[str, User] = {}
        for u in DEMO_USERS:
            user = User(
                name=u["name"],
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=Role(u["role"]),
            )
            db.add(user)
            users[u["email"]] = user
        db.flush()
        demo_user = users["demo@pujafinder.in"]
        admin_user = users["admin@pujafinder.in"]

        for i, (name, rating, comment) in enumerate(REVIEWS):
            if name in pandal_by_name:
                author = demo_user if i % 2 == 0 else admin_user
                db.add(Review(user_id=author.id, pandal_id=pandal_by_name[name].id,
                              rating=rating, comment=comment))

        for item in CROWD_REPORTS:
            name, level, wait = item[0], item[1], item[2]
            approach = item[3] if len(item) > 3 else None
            barricade = item[4] if len(item) > 4 else None
            tags = item[5] if len(item) > 5 else None
            comment = item[6] if len(item) > 6 else None
            if name in pandal_by_name:
                db.add(CrowdReport(
                    user_id=demo_user.id,
                    pandal_id=pandal_by_name[name].id,
                    crowd_level=CrowdLevel(level),
                    waiting_time_minutes=wait,
                    approach_traffic=approach,
                    barricade_distance=barricade,
                    comfort_tags=tags,
                    comment=comment,
                ))

    for name, title, desc, date, start, end, etype in EVENTS:
        if name in pandal_by_name:
            db.add(Event(
                pandal_id=pandal_by_name[name].id,
                title=title, description=desc,
                event_date=datetime.fromisoformat(f"{date}T00:00:00"),
                start_time=datetime.fromisoformat(f"{date}T{start}:00"),
                end_time=datetime.fromisoformat(f"{date}T{end}:00"),
                event_type=EventType(etype),
            ))

    if demo:
        if "College Square" in pandal_by_name:
            db.add(Favorite(user_id=demo_user.id, pandal_id=pandal_by_name["College Square"].id))
        if "Kumartuli Park" in pandal_by_name:
            db.add(Favorite(user_id=demo_user.id, pandal_id=pandal_by_name["Kumartuli Park"].id))

    for name, filename, caption in SEED_IMAGES:
        if name in pandal_by_name:
            db.add(Image(
                pandal_id=pandal_by_name[name].id,
                user_id=admin_user.id if admin_user else None,
                image_url=f"/uploads/seed/{filename}",
                caption=caption,
            ))

    db.commit()


def sync_pandals_seed(db) -> None:
    """Sync newly defined pandals into existing DB if they are missing."""
    from app.models.crowd_report import CrowdLevel, CrowdReport
    from app.models.pandal import Pandal
    from app.models.review import Review
    from app.models.user import User

    existing_names = {p.name.strip().lower() for p in db.query(Pandal.name).all()}
    demo_user = db.query(User).filter(User.email == "demo@pujafinder.in").first()

    for item in PANDALS:
        if item["name"].strip().lower() not in existing_names:
            pandal = Pandal(**item)
            db.add(pandal)
            db.flush()
            existing_names.add(item["name"].strip().lower())

            # Add demo crowd reports and reviews for new pandal if available
            if demo_user:
                for r_name, r_rating, r_comment in REVIEWS:
                    if r_name.strip().lower() == item["name"].strip().lower():
                        db.add(Review(user_id=demo_user.id, pandal_id=pandal.id, rating=r_rating, comment=r_comment))
                for c_item in CROWD_REPORTS:
                    c_name, c_level, c_wait = c_item[0], c_item[1], c_item[2]
                    c_appr = c_item[3] if len(c_item) > 3 else None
                    c_barr = c_item[4] if len(c_item) > 4 else None
                    c_tags = c_item[5] if len(c_item) > 5 else None
                    c_comment = c_item[6] if len(c_item) > 6 else None
                    if c_name.strip().lower() == item["name"].strip().lower():
                        db.add(CrowdReport(
                            user_id=demo_user.id,
                            pandal_id=pandal.id,
                            crowd_level=CrowdLevel(c_level),
                            waiting_time_minutes=c_wait,
                            approach_traffic=c_appr,
                            barricade_distance=c_barr,
                            comfort_tags=c_tags,
                            comment=c_comment,
                        ))
    db.commit()

