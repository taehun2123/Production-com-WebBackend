import { QueryError, ResultSetHeader, RowDataPacket } from "mysql2";
import { NextFunction, Request, Response } from "express"
import Cart from "../models/cart.model";
import jwt from 'jsonwebtoken'

const jwtSecret = 'sung_dong'

const postsPerPage = 5;

const cartController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.jwt_token;
    if (!token) {
      return res.status(401).json({ message: "로그인 후 사용 가능합니다." })
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.body;

      // 중복 체크를 위해 데이터베이스에서 검색
      if (Array.isArray(requestData)) {
        // If requestData is an array, iterate through each item
        const duplicateCheckPromises = requestData.map(item =>
          new Promise((resolve, reject) => {
            Cart.findOne([req.user.users_id, item.product_id, item.category_id, (item.selectedOption || item.estimateBox_selectedOption)], (err: QueryError | null, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            });
          })
        );

        Promise.all(duplicateCheckPromises)
          .then(results => {
            // Check if any duplicate is found
            if (results.some(data => data !== null)) {
              return res.status(400).json({ message: "이미 존재하는 상품이 있습니다.", success: false });
            } else {
              const listMap = requestData.map(item => ({
                product_id: item.product_id,
                category_id: item.category_id,
                parentsCategory_id: item.parentsCategory_id,
                cart_price: item.cart_price || item.product_amount,
                cart_discount: item.cart_discount || item.discount_amount,
                cart_cnt: item.cart_cnt || item.estimateBox_cnt || item.cnt,
                cart_selectedOption: item.selectedOption || item.estimateBox_selectedOption,
              }));
              const newProduct = {
                product1: listMap
              };
              Cart.create(newProduct, req.user.users_id, (err: { message: any; }, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
                // 클라이언트에서 보낸 JSON 데이터를 받음
                if (err)
                  return res.status(500).send({ message: err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다." });
                else {
                  return res.status(200).json({ message: '성공적으로 카트에 상품 등록이 완료 되었습니다.', success: true });
                }
              })
            }
          })
          .catch(err => {
            return res.status(500).send({ message: err || "서버 오류가 발생했습니다." });
          });
      } else {
        // If requestData is a single object
        Cart.findOne([req.user.users_id, requestData.product_id, requestData.category_id, (requestData.selectedOption || requestData.estimateBox_selectedOption)], (err: QueryError | null, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
          if (err) {
            // 서버 오류가 발생한 경우
            return res.status(500).send({ message: err || "서버 오류가 발생했습니다." });
          }

          // 데이터베이스에서 중복된 상품이 검색되면
          if (data) {
            return res.status(400).json({ message: "이미 존재하는 상품입니다.", success: false });
          } else {
            const listMap = [requestData].map((item: {
              discount_amount: any;
              product_amount: any;
              estimateBox_cnt: any;
              estimateBox_selectedOption: any; product_id: any; category_id: any; parentsCategory_id: any; cart_price: any; cart_discount: any; cart_cnt: any; cnt: any; selectedOption: any;
            }) => ({
              product_id: item.product_id,
              category_id: item.category_id,
              parentsCategory_id: item.parentsCategory_id,
              cart_price: item.cart_price || item.product_amount,
              cart_discount: item.cart_discount || item.discount_amount,
              cart_cnt: item.cart_cnt || item.estimateBox_cnt || item.cnt,
              cart_selectedOption: item.selectedOption || item.estimateBox_selectedOption,
            }));
            const newProduct = {
              product1: listMap
            };
            Cart.create(newProduct, req.user.users_id, (err: { message: any; }, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
              // 클라이언트에서 보낸 JSON 데이터를 받음
              if (err)
                return res.status(500).send({ message: err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다." });
              else {
                return res.status(200).json({ message: '성공적으로 카트에 상품 등록이 완료 되었습니다.', success: true });
              }
            })
          }
        })
      }
    } catch (error) {
      return res.status(403).json({ message: '회원 인증이 만료되어 재 로그인이 필요합니다.' });
    }
  },
  list: async (req: Request, res: Response) => {
    const token = req.cookies.jwt_token;
    const currentPage = req.query.page || 1;
    if (!token) {
      return res.status(401).json({ message: "로그인 후 사용 가능합니다." })
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded; // decoded에는 토큰의 내용이 들어 있음
      const requestData = req.user;
      // 데이터베이스에서 불러오기
      Cart.list(requestData.users_id, currentPage, postsPerPage, (err: { message: any; }, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
        // 클라이언트에서 보낸 JSON 데이터를 받음
        if (err)
          return res.status(500).send({ message: err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다." });
        else {
          return res.status(200).json({ message: '성공적으로 상품 갱신이 완료 되었습니다.', success: true, data });
        }
      })
    } catch (error) {
      return res.status(403).json({ message: '회원 인증이 만료되어 재 로그인이 필요합니다.' });
    }
  },
  delete: async (req: Request, res: Response) => {
    const productIds = req.params.ids.split(',').map(Number);
    Cart.deleteByIds(productIds, (err: { message: any; }, data: ResultSetHeader | RowDataPacket | RowDataPacket[] | null) => {
      // 클라이언트에서 보낸 JSON 데이터를 받음
      if (err)
        return res.status(500).send({ message: err.message || "상품을 갱신하는 중 서버 오류가 발생했습니다." });
      else {
        return res.status(200).json({ message: '성공적으로 상품 삭제가 완료 되었습니다.', success: true, data });
      }
    })
  }
}

export default cartController;