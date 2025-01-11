const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const PORT = 5000;
app.use(cors());
app.use(express.json());
const config = {
  host: "127.0.0.1",
  user: "root",
  password: "123456",
  database: "BHX",
};

// Tạo kết nối pool để quản lý kết nối hiệu quả hơn
const pool = mysql.createPool(config);
/* ==================================SẢN PHẨM=============================================================*/
// API GET - Lấy danh sách sản phẩm
app.get("/api/products", (req, res) => {
  const { search } = req.query; // Lọc theo tên sản phẩm (nếu có)
  let sql = "SELECT * FROM HANG";
  const params = [];

  if (search) {
    sql += " WHERE TENHANG LIKE ?";
    params.push(`%${search}%`);
  }

  pool.query(sql, params, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách sản phẩm:", error);
      return res.status(500).json({ error: "Lỗi khi lấy danh sách sản phẩm" });
    }
    res.json(results);
  });
});

// API GET - Lấy danh mục sản phẩm
app.get("/api/categories", (req, res) => {
  const sql =
    "SELECT DISTINCT DANHMUCHANG FROM HANG WHERE DANHMUCHANG IS NOT NULL";

  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh mục sản phẩm:", error);
      return res.status(500).json({ error: "Không thể lấy danh mục sản phẩm" });
    }

    const categories = results.map((row) => row.DANHMUCHANG);
    res.json(categories);
  });
});

// API POST - Thêm sản phẩm mới
app.post("/api/products", (req, res) => {
  const { MAVACH, TENHANG, MOTAHANG, SOLUONGHIENCO, DANHMUCHANG, DONGIA } =
    req.body;

  const sql = `
    INSERT INTO HANG (MAVACH, TENHANG, MOTAHANG, SOLUONGHIENCO, DANHMUCHANG, DONGIA)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  pool.query(
    sql,
    [MAVACH, TENHANG, MOTAHANG, SOLUONGHIENCO, DANHMUCHANG, DONGIA],
    (error, result) => {
      if (error) {
        console.error("Lỗi khi thêm sản phẩm:", error);
        return res.status(500).json({ error: "Lỗi khi thêm sản phẩm" });
      }
      res.status(201).json({ message: "Thêm sản phẩm thành công!" });
    }
  );
});
// API POST - Thêm sản phẩm từ mã phiếu lập
app.post("/api/products/from-receipt", async (req, res) => {
  const { MAPHIEU } = req.body;

  if (!MAPHIEU) {
    return res.status(400).json({ error: "Mã phiếu nhập không được để trống" });
  }

  const sqlGetProductsFromReceipt = `
    SELECT MAVACH, SOLUONGNHAP
    FROM CHITIETNHAPHANG
    WHERE SOPHIEUNHAPHANG = ?
  `;

  const sqlUpdateProductQuantity = `
    UPDATE HANG
    SET SOLUONGHIENCO = SOLUONGHIENCO + ?
    WHERE MAVACH = ?
  `;

  const connection = await pool.promise().getConnection();

  try {
    await connection.beginTransaction();

    // Lấy danh sách sản phẩm từ phiếu nhập
    const [products] = await connection.query(sqlGetProductsFromReceipt, [
      MAPHIEU,
    ]);

    if (products.length === 0) {
      throw new Error("Không tìm thấy sản phẩm trong phiếu nhập!");
    }

    // Cập nhật số lượng từng sản phẩm
    for (const product of products) {
      const { MAVACH, SOLUONGNHAP } = product;
      await connection.query(sqlUpdateProductQuantity, [SOLUONGNHAP, MAVACH]);
    }

    await connection.commit();
    res
      .status(200)
      .json({ message: "Cập nhật sản phẩm từ phiếu nhập thành công!" });
  } catch (error) {
    await connection.rollback();
    console.error("Lỗi khi cập nhật từ phiếu nhập:", error.message || error);
    res.status(500).json({ error: "Không thể cập nhật từ phiếu nhập" });
  } finally {
    connection.release();
  }
});

// API PUT - Cập nhật sản phẩm
app.put("/api/products/:MAVACH", (req, res) => {
  const { MAVACH } = req.params;
  const { TENHANG, MOTAHANG, SOLUONGHIENCO, DANHMUCHANG, DONGIA } = req.body;

  const sql = `
    UPDATE HANG
    SET TENHANG = ?, MOTAHANG = ?, SOLUONGHIENCO = ?, DANHMUCHANG = ?, DONGIA = ?
    WHERE MAVACH = ?
  `;
  pool.query(
    sql,
    [TENHANG, MOTAHANG, SOLUONGHIENCO, DANHMUCHANG, DONGIA, MAVACH],
    (error, result) => {
      if (error) {
        console.error("Lỗi khi cập nhật sản phẩm:", error);
        return res.status(500).json({ error: "Lỗi khi cập nhật sản phẩm" });
      }
      res.json({ message: "Cập nhật sản phẩm thành công!" });
    }
  );
});

// API DELETE - Xóa sản phẩm
app.delete("/api/products/:MAVACH", (req, res) => {
  const { MAVACH } = req.params;

  const sql = "DELETE FROM HANG WHERE MAVACH = ?";
  pool.query(sql, [MAVACH], (error, result) => {
    if (error) {
      console.error("Lỗi khi xóa sản phẩm:", error);
      return res.status(500).json({ error: "Lỗi khi xóa sản phẩm" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    res.json({ message: "Xóa sản phẩm thành công!" });
  });
});

// API PUT - Cập nhật số lượng sản phẩm
app.put("/api/products/update-quantity", (req, res) => {
  const { MAVACH, quantityChange } = req.body;

  const sql = `
    UPDATE HANG
    SET SOLUONGHIENCO = SOLUONGHIENCO + ?
    WHERE MAVACH = ?
  `;

  pool.query(sql, [quantityChange, MAVACH], (error, result) => {
    if (error) {
      console.error("Lỗi khi cập nhật số lượng sản phẩm:", error);
      return res.status(500).json({ error: "Không thể cập nhật số lượng" });
    }

    res.json({ message: "Cập nhật số lượng sản phẩm thành công!" });
  });
});

/* =========================== API KHÁCH HÀNG =========================== */

// API GET - Lấy danh sách khách hàng
app.get("/api/customers", (req, res) => {
  const sql = "SELECT MA_KH, HOTEN_KH, SDT_KH, EMAIL_KH FROM KHACHHANG";
  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách khách hàng:", error);
      return res
        .status(500)
        .json({ error: "Lỗi khi lấy danh sách khách hàng" });
    }
    res.json(results);
  });
});

// API POST - Thêm khách hàng mới
app.post("/api/customers", (req, res) => {
  const { MA_KH, HOTEN_KH, SDT_KH, EMAIL_KH } = req.body;
  const sql =
    "INSERT INTO KHACHHANG (MA_KH, HOTEN_KH, SDT_KH, EMAIL_KH) VALUES (?, ?, ?, ?)";
  pool.query(sql, [MA_KH, HOTEN_KH, SDT_KH, EMAIL_KH], (error, result) => {
    if (error) {
      console.error("Lỗi khi thêm khách hàng:", error);
      return res.status(500).json({ error: "Lỗi khi thêm khách hàng" });
    }
    res.status(201).json({ MA_KH, HOTEN_KH, SDT_KH, EMAIL_KH });
  });
});

// API PUT - Cập nhật khách hàng
app.put("/api/customers/:MA_KH", (req, res) => {
  const { MA_KH } = req.params;
  const { HOTEN_KH, SDT_KH, EMAIL_KH } = req.body;
  const sql =
    "UPDATE KHACHHANG SET HOTEN_KH = ?, SDT_KH = ?, EMAIL_KH = ? WHERE MA_KH = ?";
  pool.query(sql, [HOTEN_KH, SDT_KH, EMAIL_KH, MA_KH], (error, result) => {
    if (error) {
      console.error("Lỗi khi cập nhật khách hàng:", error);
      return res.status(500).json({ error: "Lỗi khi cập nhật khách hàng" });
    }
    res.json({ message: "Cập nhật khách hàng thành công!" });
  });
});

// API DELETE - Xóa khách hàng
app.delete("/api/customers/:MA_KH", (req, res) => {
  const { MA_KH } = req.params;
  const sql = "DELETE FROM KHACHHANG WHERE MA_KH = ?";
  pool.query(sql, [MA_KH], (error, result) => {
    if (error) {
      console.error("Lỗi khi xóa khách hàng:", error);
      return res.status(500).json({ error: "Lỗi khi xóa khách hàng" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng" });
    }
    res.json({ message: "Xóa khách hàng thành công!" });
  });
});

/* =========================== API NHÂN VIÊN =========================== */

// API GET - Lấy danh sách nhân viên
app.get("/api/employees", (req, res) => {
  const sql =
    "SELECT MA_NV, HOTEN_NV, DATE_FORMAT(NGAYSINH, '%Y-%m-%d') AS NGAYSINH, DIACHI_NV, CHUCVU_NV, SDT_NV, EMAIL_NV, MATKHAU_NV FROM nhanvien";
  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách nhân viên:", error);
      return res.status(500).json({ error: "Lỗi khi lấy danh sách nhân viên" });
    }
    res.json(results);
  });
});

// API POST - Thêm nhân viên mới
app.post("/api/employees", (req, res) => {
  const {
    MA_NV,
    HOTEN_NV,
    NGAYSINH,
    DIACHI_NV,
    CHUCVU_NV,
    SDT_NV,
    EMAIL_NV,
    MATKHAU_NV,
  } = req.body;

  const sql =
    "INSERT INTO nhanvien (MA_NV, HOTEN_NV, NGAYSINH, DIACHI_NV, CHUCVU_NV, SDT_NV, EMAIL_NV, MATKHAU_NV) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

  pool.query(
    sql,
    [
      MA_NV,
      HOTEN_NV,
      NGAYSINH,
      DIACHI_NV,
      CHUCVU_NV,
      SDT_NV,
      EMAIL_NV,
      MATKHAU_NV,
    ],
    (error, result) => {
      if (error) {
        console.error("Lỗi khi thêm nhân viên:", error);
        return res.status(500).json({ error: "Lỗi khi thêm nhân viên" });
      }
      res.status(201).json({
        MA_NV,
        HOTEN_NV,
        NGAYSINH,
        DIACHI_NV,
        CHUCVU_NV,
        SDT_NV,
        EMAIL_NV,
        MATKHAU_NV,
      });
    }
  );
});

// API PUT - Cập nhật nhân viên
app.put("/api/employees/:MA_NV", (req, res) => {
  const { MA_NV } = req.params;
  const {
    HOTEN_NV,
    NGAYSINH,
    DIACHI_NV,
    CHUCVU_NV,
    SDT_NV,
    EMAIL_NV,
    MATKHAU_NV,
  } = req.body;

  const sql =
    "UPDATE nhanvien SET HOTEN_NV = ?, NGAYSINH = ?, DIACHI_NV = ?, CHUCVU_NV = ?, SDT_NV = ?, EMAIL_NV = ?, MATKHAU_NV = ? WHERE MA_NV = ?";

  pool.query(
    sql,
    [
      HOTEN_NV,
      NGAYSINH,
      DIACHI_NV,
      CHUCVU_NV,
      SDT_NV,
      EMAIL_NV,
      MATKHAU_NV,
      MA_NV,
    ],
    (error, result) => {
      if (error) {
        console.error("Lỗi khi cập nhật nhân viên:", error);
        return res.status(500).json({ error: "Lỗi khi cập nhật nhân viên" });
      }
      res.json({ message: "Cập nhật nhân viên thành công!" });
    }
  );
});

// API DELETE - Xóa nhân viên
app.delete("/api/employees/:MA_NV", (req, res) => {
  const { MA_NV } = req.params;
  const sql = "DELETE FROM nhanvien WHERE MA_NV = ?";
  pool.query(sql, [MA_NV], (error, result) => {
    if (error) {
      console.error("Lỗi khi xóa nhân viên:", error);
      return res.status(500).json({ error: "Lỗi khi xóa nhân viên" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên" });
    }
    res.json({ message: "Xóa nhân viên thành công!" });
  });
});

/* ==================================Lập Phiếu Nhập=============================================================*/
// API GET - Lấy danh sách phiếu nhập
app.get("/api/receipts", (req, res) => {
  const sql = `
    SELECT PHIEUNHAPHANG.SOPHIEUNHAPHANG, 
           NHANVIEN.HOTEN_NV, 
           PHIEUNHAPHANG.NHACUNGCAP, 
           DATE_FORMAT(PHIEUNHAPHANG.NGAYNHAPHANG, '%d-%m-%Y') AS NGAYNHAPHANG
    FROM PHIEUNHAPHANG
    JOIN NHANVIEN ON PHIEUNHAPHANG.MA_NV = NHANVIEN.MA_NV
  `;
  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách phiếu nhập:", error);
      return res
        .status(500)
        .json({ error: "Lỗi khi lấy danh sách phiếu nhập" });
    }
    res.json(results);
  });
});

// API GET - Lấy chi tiết phiếu nhập
app.get("/api/receipts/:SOPHIEUNHAPHANG", (req, res) => {
  const { SOPHIEUNHAPHANG } = req.params;
  const sql = `
    SELECT CHITIETNHAPHANG.SOPHIEUNHAPHANG,
           HANG.TENHANG,
           CHITIETNHAPHANG.SOLUONGNHAP,
           CHITIETNHAPHANG.DONGIANHAP,
           CHITIETNHAPHANG.CHATLUONGHANG
    FROM CHITIETNHAPHANG
    JOIN HANG ON CHITIETNHAPHANG.MAVACH = HANG.MAVACH
    WHERE CHITIETNHAPHANG.SOPHIEUNHAPHANG = ?
  `;
  pool.query(sql, [SOPHIEUNHAPHANG], (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy chi tiết phiếu nhập:", error);
      return res.status(500).json({ error: "Lỗi khi lấy chi tiết phiếu nhập" });
    }
    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy chi tiết phiếu nhập" });
    }
    res.json(results);
  });
});
// API GET - Lấy danh sách nhà cung cấp không trùng lặp
app.get("/api/suppliers", (req, res) => {
  const sql = `
    SELECT DISTINCT NHACUNGCAP 
    FROM PHIEUNHAPHANG
    WHERE NHACUNGCAP IS NOT NULL
  `;
  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách nhà cung cấp:", error);
      return res
        .status(500)
        .json({ error: "Lỗi khi lấy danh sách nhà cung cấp" });
    }
    res.json(results.map((row) => row.NHACUNGCAP));
  });
});

// API POST - Thêm phiếu nhập hàng
app.post("/api/receipts", (req, res) => {
  const { SOPHIEUNHAPHANG, MA_NV, NHACUNGCAP, NGAYNHAPHANG } = req.body;
  const sql = `
    INSERT INTO PHIEUNHAPHANG (SOPHIEUNHAPHANG, MA_NV, NHACUNGCAP, NGAYNHAPHANG)
    VALUES (?, ?, ?, ?)
  `;
  pool.query(
    sql,
    [SOPHIEUNHAPHANG, MA_NV, NHACUNGCAP, NGAYNHAPHANG],
    (error) => {
      if (error) {
        console.error("Lỗi khi thêm phiếu nhập hàng:", error);
        return res.status(500).json({ error: "Lỗi khi thêm phiếu nhập hàng" });
      }
      res.status(201).json({ message: "Thêm phiếu nhập hàng thành công!" });
    }
  );
});

// API POST - Thêm chi tiết phiếu nhập hàng
app.post("/api/receipt-details", (req, res) => {
  const { SOPHIEUNHAPHANG, MAVACH, SOLUONGNHAP, DONGIANHAP } = req.body;
  const sql = `
    INSERT INTO CHITIETNHAPHANG (SOPHIEUNHAPHANG, MAVACH, SOLUONGNHAP, DONGIANHAP, CHATLUONGHANG)
    VALUES (?, ?, ?, ?, DEFAULT)
  `;
  pool.query(
    sql,
    [SOPHIEUNHAPHANG, MAVACH, SOLUONGNHAP, DONGIANHAP],
    (error) => {
      if (error) {
        console.error("Lỗi khi thêm chi tiết phiếu nhập hàng:", error);
        return res
          .status(500)
          .json({ error: "Lỗi khi thêm chi tiết phiếu nhập hàng" });
      }
      res.status(201).json({ message: "Thêm chi tiết phiếu nhập thành công!" });
    }
  );
});
/* ==================================Lập Hóa Đơn=============================================================*/
// API GET - Lấy danh sách hóa đơn
app.get("/api/invoices", (req, res) => {
  const sql = `
    SELECT HOADON.MA_HD, 
           KHACHHANG.HOTEN_KH, 
           NHANVIEN.HOTEN_NV, 
           DATE_FORMAT(HOADON.NGAYLAPHOADON, '%d-%m-%Y') AS NGAYLAPHOADON, 
           HOADON.DATHANHTOAN,
           HOADON.TONGTIEN
    FROM HOADON
    LEFT JOIN KHACHHANG ON HOADON.MA_KH = KHACHHANG.MA_KH
    JOIN NHANVIEN ON HOADON.MA_NV = NHANVIEN.MA_NV
  `;
  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách hóa đơn:", error);
      return res.status(500).json({ error: "Lỗi khi lấy danh sách hóa đơn" });
    }
    res.json(results);
  });
});

// API GET - Lấy chi tiết hóa đơn
app.get("/api/invoices/:MA_HD", (req, res) => {
  const { MA_HD } = req.params;
  const sql = `
    SELECT CHITIETHOADON.MA_HD,
           HANG.TENHANG,
           CHITIETHOADON.SOLUONGBAN,
           CHITIETHOADON.GIAMGIA,
           CHITIETHOADON.THANHTIEN
    FROM CHITIETHOADON
    JOIN HANG ON CHITIETHOADON.MAVACH = HANG.MAVACH
    WHERE CHITIETHOADON.MA_HD = ?
  `;
  pool.query(sql, [MA_HD], (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy chi tiết hóa đơn:", error);
      return res.status(500).json({ error: "Lỗi khi lấy chi tiết hóa đơn" });
    }
    res.json(results);
  });
});

// API POST - Thêm hóa đơn
app.post("/api/invoices", async (req, res) => {
  const { MA_HD, MA_KH, MA_NV, NGAYLAPHOADON, DATHANHTOAN, details } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (
    !MA_HD ||
    !MA_NV ||
    !NGAYLAPHOADON ||
    !Array.isArray(details) ||
    details.length === 0
  ) {
    return res.status(400).json({ error: "Dữ liệu đầu vào không hợp lệ!" });
  }

  const connection = await pool.promise().getConnection();
  try {
    await connection.beginTransaction();

    const totalAmount = details.reduce(
      (sum, detail) => sum + detail.THANHTIEN,
      0
    );
    const finalMA_KH = MA_KH || "kh001";

    // Thêm hóa đơn chính
    const sqlInvoice = `
      INSERT INTO HOADON (MA_HD, MA_KH, MA_NV, NGAYLAPHOADON, DATHANHTOAN, TONGTIEN)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await connection.query(sqlInvoice, [
      MA_HD,
      finalMA_KH,
      MA_NV,
      NGAYLAPHOADON,
      DATHANHTOAN,
      totalAmount,
    ]);

    // Thêm chi tiết hóa đơn và trừ số lượng sản phẩm
    for (const detail of details) {
      const { MAVACH, SOLUONGBAN, GIAMGIA, THANHTIEN } = detail;

      const sqlDetail = `
        INSERT INTO CHITIETHOADON (MA_HD, MAVACH, SOLUONGBAN, GIAMGIA, THANHTIEN)
        VALUES (?, ?, ?, ?, ?)
      `;
      await connection.query(sqlDetail, [
        MA_HD,
        MAVACH,
        SOLUONGBAN,
        GIAMGIA,
        THANHTIEN,
      ]);

      // Trừ số lượng sản phẩm trong bảng HANG
      const sqlUpdateProduct = `
        UPDATE HANG
        SET SOLUONGHIENCO = SOLUONGHIENCO - ?
        WHERE MAVACH = ? AND SOLUONGHIENCO >= ?
      `;
      const [updateResult] = await connection.query(sqlUpdateProduct, [
        SOLUONGBAN,
        MAVACH,
        SOLUONGBAN,
      ]);
      if (updateResult.affectedRows === 0) {
        throw new Error(`Số lượng sản phẩm không đủ: ${MAVACH}`);
      }
    }

    await connection.commit();
    res.status(201).json({ message: "Thêm hóa đơn thành công!" });
  } catch (error) {
    await connection.rollback();
    console.error("Lỗi khi thêm hóa đơn:", error.message || error);
    res.status(500).json({ error: error.message || "Lỗi khi thêm hóa đơn" });
  } finally {
    connection.release();
  }
});

// API PUT - Cập nhật trạng thái thanh toán của hóa đơn
app.put("/api/invoices/:MA_HD", (req, res) => {
  const { MA_HD } = req.params;
  const { DATHANHTOAN } = req.body;
  const sql = "UPDATE HOADON SET DATHANHTOAN = ? WHERE MA_HD = ?";
  pool.query(sql, [DATHANHTOAN, MA_HD], (error, result) => {
    if (error) {
      console.error("Lỗi khi cập nhật trạng thái thanh toán:", error);
      return res
        .status(500)
        .json({ error: "Không thể cập nhật trạng thái thanh toán" });
    }
    res.json({ message: "Cập nhật trạng thái thanh toán thành công!" });
  });
});

// API GET - Lấy danh sách sản phẩm để hiển thị tên trong combobox
app.get("/api/products", (req, res) => {
  const sql = `
    SELECT MAVACH, TENHANG
    FROM HANG
  `;
  pool.query(sql, (error, results) => {
    if (error) {
      console.error("Lỗi khi lấy danh sách sản phẩm:", error);
      return res.status(500).json({ error: "Lỗi khi lấy danh sách sản phẩm" });
    }
    res.json(results);
  });
});
// API PUT - Cập nhật số lượng sản phẩm khi thanh toán
app.put("/api/invoices/:MA_HD/update-stock", async (req, res) => {
  const { MA_HD } = req.params;

  const connection = await pool.promise().getConnection();
  try {
    await connection.beginTransaction();

    // Lấy chi tiết hóa đơn
    const sqlGetDetails = `
      SELECT MAVACH, SOLUONGBAN
      FROM CHITIETHOADON
      WHERE MA_HD = ?
    `;
    const [details] = await connection.query(sqlGetDetails, [MA_HD]);

    if (details.length === 0) {
      throw new Error("Không tìm thấy chi tiết hóa đơn!");
    }

    // Cập nhật số lượng sản phẩm
    for (const detail of details) {
      const { MAVACH, SOLUONGBAN } = detail;
      const sqlUpdateStock = `
        UPDATE HANG
        SET SOLUONGHIENCO = SOLUONGHIENCO - ?
        WHERE MAVACH = ? AND SOLUONGHIENCO >= ?
      `;
      const [updateResult] = await connection.query(sqlUpdateStock, [
        SOLUONGBAN,
        MAVACH,
        SOLUONGBAN,
      ]);

      if (updateResult.affectedRows === 0) {
        throw new Error(
          `Số lượng sản phẩm không đủ hoặc sản phẩm không tồn tại: ${MAVACH}`
        );
      }
    }

    await connection.commit();
    res.json({ message: "Cập nhật số lượng sản phẩm thành công!" });
  } catch (error) {
    await connection.rollback();
    console.error(
      "Lỗi khi cập nhật số lượng sản phẩm:",
      error.message || error
    );
    res
      .status(500)
      .json({ error: error.message || "Lỗi khi cập nhật số lượng sản phẩm" });
  } finally {
    connection.release();
  }
});

/* ==================================Đăng nhập=============================================================*/
// API Đăng nhập
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  // Sử dụng MA_NV thay vì EMAIL_NV
  const sql = "SELECT * FROM nhanvien WHERE MA_NV = ? AND MATKHAU_NV = ?";
  pool.query(sql, [username, password], (error, results) => {
    if (error) {
      console.error("Lỗi khi truy vấn:", error);
      return res.status(500).json({ success: false, message: "Lỗi hệ thống!" });
    }

    if (results.length > 0) {
      const user = results[0];

      // Định dạng lại ngày sinh thành dd-mm-yyyy
      const formattedDate = new Date(user.NGAYSINH);
      const day = formattedDate.getDate().toString().padStart(2, "0");
      const month = (formattedDate.getMonth() + 1).toString().padStart(2, "0");
      const year = formattedDate.getFullYear();
      const formattedDateOfBirth = `${day}-${month}-${year}`;

      res.json({
        success: true,
        message: "Đăng nhập thành công!",
        user: {
          id: user.MA_NV,
          name: user.HOTEN_NV,
          role: user.CHUCVU_NV,
          dateOfBirth: formattedDateOfBirth, // Trả về ngày sinh đã định dạng
          address: user.DIACHI_NV,
          phone: user.SDT_NV,
          email: user.EMAIL_NV,
        },
      });
    } else {
      res.json({ success: false, message: "Tên đăng nhập hoặc mật khẩu sai!" });
    }
  });
});

// API kiểm tra kết nối server
app.get("/", (req, res) => {
  res.send(" API server đang chạy.");
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
