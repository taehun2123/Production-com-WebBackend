import { QueryError, ResultSetHeader, RowDataPacket } from "mysql2";
import { NextFunction, Request, Response } from "express";
import Order from "../models/order.model";
import jwt from "jsonwebtoken";
import User from "../models/auth.model";
import shortid from "shortid";
import Product from "../models/product.model";
const jwtSecret = "sung_dong";
import ExcelJs from "exceljs";
import { Readable } from "stream";

const postsPerPage = 5;

const orderController = {
  write: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }
    try {
      const requestData = req.body;
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;

      const userData = req.user;

      const newProduct = requestData.map((item: any) => ({
        ...item,
        product_id: item.product_id,
        category_id: item.category_id,
        parentsCategory_id: item.parentsCategory_id,
        cart_price: item.cart_price || item.product_amount,
        cart_discount: item.cart_discount || item.discount_amount,
        cart_cnt: item.cart_cnt || item.cnt,
        cart_selectedOption: item.cart_selectedOption || item.selectedOption,
      }));
      try {
        const checkedSupply = await Product.checkedSupply(newProduct);
        if (checkedSupply) {
          User.findAllUserInfo(
            userData,
            (
              err: QueryError | string | null,
              data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
            ) => {
              if (err) {
                return res.status(500).send({ message: err });
              } else {
                req.session.orderData = newProduct;
                res
                  .status(200)
                  .json({
                    success: true,
                    message: "해당 상품들로 주문서 작성을 시작합니다.",
                    newProduct,
                    data,
                  });
              }
            }
          );
        }
      } catch (error: any) {
        return res.status(400).json({ message: error.message, success: false });
      }
    } catch (error) {
      return res
        .status(403)
        .json({ message: "회원인증이 만료되어 재 로그인이 필요합니다." });
    }
  },
  create: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res.status(401).json({ message: "로그인 후 사용 가능합니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.body;
      const newId = shortid();
      const orderListMap = requestData.orderList.map(
        (item: {
          cart_discount: number;
          cart_price: any;
          cart_cnt: any;
          cart_selectedOption: string;
          cart_amount: string;
          category_id: string;
          parentsCategory_id: string;
          product_id: string;
        }) => ({
          order_id: newId,
          users_id: req.user.users_id,
          product_id: item.product_id,
          parentsCategory_id: item.parentsCategory_id,
          category_id: item.category_id,
          order_cnt: item.cart_cnt,
          order_productPrice: item.cart_price * item.cart_cnt,
          selectedOption: item.cart_selectedOption,
        })
      );
      const newProduct = {
        product1: {
          order_id: newId,
          users_id: req.user.users_id,
          userType_id: req.user.userType_id,
          ...((
            {
              address,
              checked,
              isCart,
              ...restOrderInfo
            } = requestData.orderInformation
          ) => restOrderInfo)(),
          zonecode: requestData.orderInformation.address.zonecode,
          roadAddress: requestData.orderInformation.address.roadAddress,
          bname: requestData.orderInformation.address.bname,
          buildingName: requestData.orderInformation.address.buildingName,
          jibunAddress: requestData.orderInformation.jibunAddress
            ? requestData.orderInformation.jibunAddress
            : "",
          order_payAmount: requestData.orderList.reduce(
            (
              sum: number,
              item: {
                cart_price: number;
                cart_cnt: number;
                cart_discount: number;
              } //reduce 함수사용하여 배열 객체의 합계 계산, delivery값으로 sum을 초기화
            ) => sum + item.cart_price * item.cart_cnt,
            3000
          ),
          orderState:
            requestData.orderInformation.order_payRoute === "CMS" ? 1 : 0,
          order_payName: requestData.orderInformation.order_payName
            ? requestData.orderInformation.order_payName
            : "",
        },
        product2: orderListMap,
        product3: {
          order_id: newId,
          users_id: req.user.users_id,
          ...requestData.deliveryInformation,
        },
      };
      Order.create([newProduct, newId], (err: { message: any }) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 주문이 완료 되었습니다.",
              success: true,
            });
        }
      });
    } catch (error) {
      return res
        .status(403)
        .json({ message: "회원 인증이 만료되어 재 로그인이 필요합니다." });
    }
  },
  list: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    // 요청에서 페이지 번호 가져오기 (기본값은 1)
    const currentPage = req.query.page || 1;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.user;
      // 데이터베이스에서 불러오기
      Order.list(
        requestData.users_id,
        currentPage,
        postsPerPage,
        (err: { message: any }, data: any | null) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문 상품 갱신이 완료 되었습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "인증이 만료되어 재 로그인이 필요합니다." });
    }
  },
  raeList: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    // 요청에서 페이지 번호 가져오기 (기본값은 1)
    const currentPage = req.query.page || 1;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.user;
      // 데이터베이스에서 불러오기
      Order.raeList(
        requestData.users_id,
        currentPage,
        postsPerPage,
        (err: { message: any }, data: any | null) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문 상품 갱신이 완료 되었습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "인증이 만료되어 재 로그인이 필요합니다." });
    }
  },
  findList: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.user;
      // 데이터베이스에서 불러오기
      Order.findList(
        requestData.users_id,
        (
          err: { message: any },
          data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
        ) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 상품 갱신이 완료 되었습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "회원 인증이 만료되어 재 로그인이 필요합니다." });
    }
  },
  findSelectOrderList: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.user;
      // 데이터베이스에서 불러오기
      Order.findSelectOrderList(
        requestData.users_id,
        req.body.order_id,
        (
          err: { message: any },
          data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
        ) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message ||
                  "주문 내역을 갱신 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문 내역을 불러왔습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "회원 인증이 만료되어 로그인이 필요합니다." });
    }
  },
  findOne: async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.user;
      // 데이터베이스에서 불러오기
      Order.findOne(
        requestData.users_id,
        (err: { message: any }, data: any) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문내역을 불러왔습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "인증이 만료되어 로그인이 필요합니다." });
    }
  },

  selectOrderProductById: async (req: Request, res: Response) => {
    try {
      // 데이터베이스에서 불러오기
      Order.selectOrderProductById(
        req.body.order_id,
        (
          err: { message: any },
          data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
        ) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message ||
                  "주문 내역을 갱신 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문 내역을 불러왔습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(500)
        .json({ message: "예기치 못한 오류가 발생했습니다." });
    }
  },

  adminModule: async (req: Request, res: Response) => {
    try {
      // 데이터베이스에서 불러오기
      Order.adminModule((err: { message: any }, data: any | null) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 주문 상품 갱신이 완료 되었습니다.",
              success: true,
              data,
            });
        }
      });
    } catch (error) {
      return res
        .status(403)
        .json({ message: "인증이 만료되어 재 로그인이 필요합니다." });
    }
  },

  // 모든 배송 데이터 조회 - 미결제 / 주문완료 건
  orderAll: async (req: Request, res: Response) => {
    const currentPage = parseInt(req.query.page as string, 10) || 1; // 페이지 번호 쿼리 파라미터를 읽어옴
    const itemsPerPage = parseInt(req.query.post as string, 10) || 10; // 페이지 당 아이템 개수 쿼리 파라미터를 읽어옴
    // 데이터베이스에서 불러오기
    Order.getOrderList(
      currentPage,
      itemsPerPage,
      (
        err: { message: any },
        data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
      ) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "상품을 갱신하는 중 서버 오류가 발생했 습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 상품 갱신이 완료 되었습니다.",
              success: true,
              data,
            });
        }
      }
    );
  },

  // 모든 배송 데이터 조회 - 엑셀 출력용
  orderAllItems: async (req: Request, res: Response) => {
    const currentPage = parseInt(req.query.page as string, 10) || 1; // 페이지 번호 쿼리 파라미터를 읽어옴
    const itemsPerPage = parseInt(req.query.post as string, 10) || 10; // 페이지 당 아이템 개수 쿼리 파라미터를 읽어옴
    // 데이터베이스에서 불러오기
    Order.getOrderListItems(
      currentPage,
      itemsPerPage,
      (
        err: { message: any },
        data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
      ) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "상품을 갱신하는 중 서버 오류가 발생했 습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 상품 갱신이 완료 되었습니다.",
              success: true,
              data,
            });
        }
      }
    );
  },

  // 모든 배송 데이터 조회 - 미결제 / 주문완료 건
  cancelOrderAll: async (req: Request, res: Response) => {
    const currentPage = parseInt(req.query.page as string, 10) || 1; // 페이지 번호 쿼리 파라미터를 읽어옴
    const itemsPerPage = parseInt(req.query.post as string, 10) || 10; // 페이지 당 아이템 개수 쿼리 파라미터를 읽어옴
    // 데이터베이스에서 불러오기
    Order.getCanceledOrderList(
      currentPage,
      itemsPerPage,
      (
        err: { message: any },
        data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
      ) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "상품을 갱신하는 중 서버 오류가 발생했 습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 상품 갱신이 완료 되었습니다.",
              success: true,
              data,
            });
        }
      }
    );
  },

  // 송장수정 변경사항 적용
  applyEditedInvoice: async (req: Request, res: Response) => {
    try {
      // 요청에서 변경된 배송 상태 데이터 추출
      const fetchedData = req.body;

      // 유효성 검사: 변경된 배송 상태 데이터가 유효한지 확인
      if (!Array.isArray(fetchedData)) {
        return res.status(400).json({ message: "잘못된 데이터 형식입니다." });
      }

      // 데이터 처리: 변경된 배송 상태 데이터를 데이터베이스에 업데이트
      await Promise.all(
        fetchedData?.map(
          async (item: {
            value: any;
            order_id: string;
            delivery_selectedCor: string;
            delivery_num: string;
          }) => {
            await Order.updateDeliveryInvoice(
              item.value.order_id,
              item.value.delivery_num
            );
          }
        )
      );

      // 응답 전송: 업데이트 성공
      return res
        .status(200)
        .json({ message: "배송 상태가 성공적으로 업데이트되었습니다." });
    } catch (error) {
      // 응답 전송: 업데이트 실패
      console.error("배송 상태 업데이트 중 오류가 발생했습니다:", error);
      return res
        .status(500)
        .json({ message: "배송 상태 업데이트 중 오류가 발생했습니다." });
    }
  },

  // 주문취소
  cancelOrder: async (req: Request, res: Response) => {
    try {
      // 요청에서 변경된 배송 상태 데이터 추출
      const fetchedData = req.body;

      // 유효성 검사: 변경된 배송 상태 데이터가 유효한지 확인
      if (!Array.isArray(fetchedData)) {
        return res.status(400).json({ message: "잘못된 데이터 형식입니다." });
      }

      // 데이터 처리: 변경된 배송 상태 데이터를 데이터베이스에 업데이트
      await Promise.all(
        fetchedData?.map(
          async (item: {
            value: any;
            cancelReason: string;
            order_id: string;
          }) => {
            await Order.cancelOrder(
              item.value.cancelReason,
              item.value.order_id
            );
          }
        )
      );

      // 응답 전송: 업데이트 성공
      return res
        .status(200)
        .json({ message: "주문 상태가 성공적으로 업데이트되었습니다." });
    } catch (error) {
      // 응답 전송: 업데이트 실패
      console.error("주문 상태 업데이트 중 오류가 발생했습니다:", error);
      return res
        .status(500)
        .json({ message: "주문 상태 업데이트 중 오류가 발생했습니다." });
    }
  },

  filter: async (req: Request, res: Response) => {
    const currentPage = parseInt(req.query.page as string) || 1;
    const postsPerPage = parseInt(req.query.post as string) || 10;
    const requestData = req.body?.filter ? req.body?.filter : req.body;
    const orderState = req.body?.limit ? req.body?.limit?.orderState : null;
    console.log(requestData);
    console.log(orderState);
    const newFilter = {
      selectFilter: requestData.selectFilter || "",
      filterValue: requestData.filterValue || "",
      deliveryType: requestData.deliveryType || "",
      dateStart: requestData.date.start,
      dateEnd: requestData.date.end,
      orderState: requestData.orderState ? requestData.orderState : "" || "",
    };
    Order.filter(
      newFilter,
      currentPage,
      postsPerPage,
      orderState,
      (
        err: { message: any },
        data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
      ) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "주문을 갱신하는 중 서버 오류가 발생했습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 주문 조회가 완료 되었습니다.",
              success: true,
              data,
            });
        }
      }
    );
  },

  raeFilter: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const currentPage = parseInt(req.query.page as string) || 1;
      const postsPerPage = parseInt(req.query.post as string) || 10;
      const requestData = req.body;
      const newFilter = {
        product_id: requestData.product_id || "",
        product_title: requestData.product_title || "",
        product_brand: requestData.product_brand || "",
        product_spec: requestData.product_spec || "",
        product_model: requestData.product_model || "",
        dateStart: requestData.date.start || "",
        dateEnd: requestData.date.end || "",
      };
      Order.raeFilter(
        req.user.users_id,
        newFilter,
        currentPage,
        postsPerPage,
        (
          err: { message: any },
          data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
        ) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message || "주문을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문 조회가 완료 되었습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "인증이 만료되어 로그인이 필요합니다." });
    }
  },

  // 유저 측 주문취소 요청
  requestCancelOrder: async (req: Request, res: Response) => {
    try {
      // 요청에서 변경된 배송 상태 데이터 추출
      const item = req.body;
      // 데이터 처리: 변경된 배송 상태 데이터를 데이터베이스에 업데이트
      Order.requestCancelOrder(
        item.cancelReason,
        item.order_id,
        (
          err: { message: any },
          data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
        ) => {
          if (err) {
            return res
              .status(500)
              .send({
                message:
                  err.message || "주문을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          } else {
            return res
              .status(200)
              .json({ message: "주문 상태가 성공적으로 업데이트되었습니다." });
          }
        }
      );
    } catch (error) {
      // 응답 전송: 업데이트 실패
      console.error("주문 상태 업데이트 중 오류가 발생했습니다:", error);
      return res
        .status(500)
        .json({ message: "주문 상태 업데이트 중 오류가 발생했습니다." });
    }
  },

  search: async (req: Request, res: Response) => {
    const currentPage = parseInt(req.query.page as string) || 1;
    const postsPerPage = parseInt(req.query.post as string) || 10;
    const token = req.cookies.jwt_token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "로그인 후 이용가능한 서비스입니다." });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.body;
      const newSearch = {
        product_title: requestData.search || "",
        product_id: requestData.search || "",
        product_model: requestData.search || "",
        product_spec: requestData.search || "",
        product_brand: requestData.search || "",
      };
      Order.search(
        req.user.users_id,
        newSearch,
        currentPage,
        postsPerPage,
        (
          err: { message: any },
          data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
        ) => {
          // 클라이언트에서 보낸 JSON 데이터를 받음
          if (err)
            return res
              .status(500)
              .send({
                message:
                  err.message || "주문을 갱신하는 중 서버 오류가 발생했습니다.",
              });
          else {
            return res
              .status(200)
              .json({
                message: "성공적으로 주문 조회가 완료 되었습니다.",
                success: true,
                data,
              });
          }
        }
      );
    } catch (error) {
      return res
        .status(403)
        .json({ message: "인증이 만료되어 로그인이 필요합니다." });
    }
  },

  printExcel: async (req: Request, res: Response) => {
    const workbook = new ExcelJs.Workbook();
    const worksheet = workbook.addWorksheet("first");
    worksheet.columns = [
      { header: "주문번호", key: "order_id", width: 20 },
      { header: "배송방법", key: "deliveryType", width: 20 },
      { header: "배송사", key: "deliverySelect", width: 20 },
      { header: "상품명", key: "product_title", width: 20 },
      { header: "상품코드", key: "product_id", width: 20 },
      { header: "상품 모델명", key: "product_model", width: 20 },
      { header: "상품 규격", key: "product_spec", width: 20 },
      { header: "주문가", key: "order_payAmount", width: 20 },
      { header: "주문일자", key: "order_date", width: 20 },
      { header: "기업명", key: "corName", width: 20 },
      { header: "주문자명", key: "order_name", width: 20 },
      { header: "주문자 전화번호", key: "order_tel", width: 20 },
      { header: "주소", key: "roadAddress", width: 20 },
      { header: "배송메세지", key: "delivery_message", width: 20 },
      { header: "성동메세지", key: "smtMessage", width: 20 },
      { header: "결제방법", key: "order_payRoute", width: 20 },
      { header: "증빙서류발급", key: "order_moneyReceipt", width: 20 },
    ];
    worksheet.insertRows(2, req.body);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader("Content-Disposition", `attachment; filename=test.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  },

  delete: async (req: Request, res: Response) => {
    const ids = req.params.ids.split(",").map(String);
    Order.deleteByIds(
      ids,
      (
        err: { message: any },
        data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null
      ) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res
            .status(500)
            .send({
              message:
                err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다.",
            });
        else {
          return res
            .status(200)
            .json({
              message: "성공적으로 주문 삭제가 완료 되었습니다.",
              success: true,
              data,
            });
        }
      }
    );
  },
};

export default orderController;
