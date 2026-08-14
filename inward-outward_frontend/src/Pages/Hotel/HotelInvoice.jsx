import React, { useMemo, useState } from "react";
import "./HotelInvoice.scss";
import { FaHotel, FaSearch, FaFileInvoice, FaDownload } from "react-icons/fa";

// 12 premium hotel room images (Unsplash)
const hotelImages = [
    "https://theozencollection.com/ozenmansion-kolkata/_next/image?url=https%3A%2F%2Ftoc-ucmsapi.theozencollection.com%2FTOC%2Fimages%2FpropertyImagesc4ea7a8a-894c-473e-9fd8-bfbf9d6c4f25blob.png&w=1920&q=75",
    "https://www.v-hotels.in/assets/site-images/blogs/3.png",
    "https://plus.unsplash.com/premium_photo-1661963239507-7bdf41a5e66b?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bHV4cnklMjBob3RlbCUyMHJvb218ZW58MHx8MHx8fDA%3D",
    "https://img.freepik.com/free-photo/3d-rendering-beautiful-comtemporary-luxury-bedroom-suite-hotel-with-tv_105762-2058.jpg?semt=ais_hybrid&w=740&q=80",
    "https://assets.simplotel.com/simplotel/image/upload/x_0,y_294,w_3200,h_1799,r_0,c_crop,q_80,fl_progressive/w_900,f_auto,c_fit/pride-plaza-hotel-ahmedabad/1_4_hudrzu?1759276800074",
    "https://productimages.withfloats.com/actual/5c1de000ee85c30001f5567f.jpg",
    "https://static.toiimg.com/photo/51107660/.jpg",
    "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/22/3b/30/7e/amber-dale-luxury-hotel.jpg?w=900&h=-1&s=1",
    "https://www.thetranshotel.com/images/editor/images/Premier_Twin%20Bedroom.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0iej5A3RNtu92bRq2giXfxuQb_Lk8jP2POQ&s",
    "https://cf.bstatic.com/static/img/theme-index/bg_luxury/869918c9da63b2c5685fce05965700da5b0e6617.jpg",
    "https://plus.unsplash.com/premium_photo-1661884238187-1c274b3c3413?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8bHV4dXJ5JTIwaG90ZWwlMjByb29tfGVufDB8fDB8fHww"
];

const dummyRooms = [
    { number: 101, type: "Standard", status: "available", guest: null },
    { number: 102, type: "Deluxe", status: "booked", guest: { name: "John Doe", checkIn: "2025-10-01", checkOut: "2025-10-05", amount: 450 } },
    { number: 103, type: "Premium", status: "available", guest: null },
    { number: 104, type: "Standard", status: "booked", guest: { name: "Alice Smith", checkIn: "2025-10-02", checkOut: "2025-10-06", amount: 380 } },
    { number: 105, type: "Deluxe", status: "available", guest: null },
    { number: 106, type: "Premium", status: "booked", guest: { name: "David Brown", checkIn: "2025-10-01", checkOut: "2025-10-03", amount: 600 } },
    { number: 107, type: "Standard", status: "available", guest: null },
    { number: 108, type: "Premium", status: "booked", guest: { name: "Sophia Lee", checkIn: "2025-10-03", checkOut: "2025-10-08", amount: 720 } },
    { number: 109, type: "Deluxe", status: "available", guest: null },
    { number: 110, type: "Standard", status: "available", guest: null },
    { number: 111, type: "Premium", status: "booked", guest: { name: "Emma Wilson", checkIn: "2025-10-02", checkOut: "2025-10-04", amount: 420 } },
    { number: 112, type: "Deluxe", status: "available", guest: null }
];

const typesOrder = ["Standard", "Deluxe", "Premium"];

const HotelInvoice = () => {
    const [search, setSearch] = useState("");
    const [selectedRoom, setSelectedRoom] = useState(null);

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = dummyRooms.filter((r) => {
            if (!q) return true;
            return (
                r.number.toString().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                (r.guest && r.guest.name.toLowerCase().includes(q))
            );
        });
        const map = {};
        typesOrder.forEach((t) => (map[t] = []));
        filtered.forEach((r) => {
            if (!map[r.type]) map[r.type] = [];
            map[r.type].push(r);
        });
        return map;
    }, [search]);

    const stats = {
        total: dummyRooms.length,
        booked: dummyRooms.filter((r) => r.status === "booked").length,
        available: dummyRooms.filter((r) => r.status === "available").length
    };

    const handleExport = () => {
        const rows = [["Room", "Type", "Status", "Guest", "CheckIn", "CheckOut", "Amount"]];
        dummyRooms.forEach((r) =>
            rows.push([
                r.number,
                r.type,
                r.status,
                r.guest ? r.guest.name : "",
                r.guest ? r.guest.checkIn : "",
                r.guest ? r.guest.checkOut : "",
                r.guest ? r.guest.amount || "" : ""
            ])
        );
        const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "rooms_export.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="hotel-invoice">
            <nav className="topbar">
                <div className="brand">
                    <FaHotel className="brand-icon" />
                    <div className="brand-text">
                        <div className="hotel-name">Techorses Hospitality</div>
                        <div className="slogan">Comfort & Class — invoices simplified</div>
                    </div>
                </div>
                <div className="nav-actions">
                    <div className="stats">
                        <div className="stat total">Total <strong>{stats.total}</strong></div>
                        <div className="stat booked">Booked <strong>{stats.booked}</strong></div>
                        <div className="stat available">Available <strong>{stats.available}</strong></div>
                    </div>
                    <div className="search">
                        <FaSearch className="search-icon" />
                        <input
                            placeholder="Search by room, type or guest..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="btn export" onClick={handleExport}>
                        <FaDownload /> Export CSV
                    </button>
                </div>
            </nav>

            <main className="page">
                <header className="page-header">
                    <div className="title">
                        <h2>Room Invoice Management</h2>
                        <p className="sub">Interactive demo — click any card to open invoice or booking details</p>
                    </div>
                    <div className="legend">
                        <span className="box available" /> Available
                        <span className="box booked" /> Booked
                        <button className="btn demo-invoice"><FaFileInvoice /> Create Demo Invoice</button>
                    </div>
                </header>

                <section className="sections">
                    {typesOrder.map((type) => {
                        const list = grouped[type] || [];
                        return (
                            <div className="room-section" key={type}>
                                <div className="section-heading">
                                    <h3>{type} Rooms</h3>
                                    <p className="section-sub">{list.length} room{list.length !== 1 ? "s" : ""} • stylish {type.toLowerCase()} selection</p>
                                </div>
                                <div className="room-row">
                                    {list.length === 0 ? (
                                        <div className="empty">No rooms found in this category.</div>
                                    ) : (
                                        <div className="room-grid">
                                            {list.map((room, idx2) => {
                                                const img = hotelImages[(idx2 + (typesOrder.indexOf(type) * 4)) % hotelImages.length];
                                                return (
                                                    <article
                                                        key={room.number}
                                                        className={`room-card ${room.status}`}
                                                        onClick={() => setSelectedRoom(room)}
                                                        title={
                                                            room.status === "booked"
                                                                ? `Booked: ${room.guest?.name}`
                                                                : "Available - click to open invoice demo"
                                                        }
                                                    >
                                                        <div className="room-thumb">
                                                            <img src={img} alt={`${room.type} ${room.number}`} />
                                                            <div className="type-badge">{room.type}</div>
                                                            {room.status === "booked" && <div className="occupancy-badge">Occupied</div>}
                                                        </div>
                                                        <div className="room-body">
                                                            <div className="room-number">Room {room.number}</div>
                                                            <div className="room-meta">{room.type} • {room.status === "booked" ? "Booked" : "Available"}</div>
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>
            </main>

            {selectedRoom && (
                <div className="modal-overlay" onClick={() => setSelectedRoom(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        {selectedRoom.status === "available" ? (
                            <>
                                <h3>Invoice — Room {selectedRoom.number}</h3>
                                <form className="invoice-form" onSubmit={(e) => e.preventDefault()}>
                                    <label>Guest Name</label>
                                    <input placeholder="Enter guest name" />
                                    <div className="row">
                                        <div>
                                            <label>Check-in</label>
                                            <input type="date" />
                                        </div>
                                        <div>
                                            <label>Check-out</label>
                                            <input type="date" />
                                        </div>
                                    </div>
                                    <label>Amount</label>
                                    <input type="number" placeholder="Amount" />
                                    <div className="form-actions">
                                        <button className="btn primary" type="button" onClick={() => alert("Invoice (demo) generated!")}>Generate Invoice</button>
                                        <button className="btn" onClick={() => setSelectedRoom(null)}>Cancel</button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <>
                                <h3>Booking Details — Room {selectedRoom.number}</h3>
                                <div className="booking-details">
                                    <p><strong>Guest:</strong> {selectedRoom.guest.name}</p>
                                    <p><strong>Check-in:</strong> {selectedRoom.guest.checkIn}</p>
                                    <p><strong>Check-out:</strong> {selectedRoom.guest.checkOut}</p>
                                    <p><strong>Amount:</strong> ${selectedRoom.guest.amount || "—"}</p>
                                </div>
                                <div className="form-actions">
                                    <button className="btn primary" onClick={() => alert("Open invoice preview (demo)")}><FaFileInvoice /> View Invoice</button>
                                    <button className="btn" onClick={() => setSelectedRoom(null)}>Close</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HotelInvoice;
