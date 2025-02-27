import { QueryError, RowDataPacket, ResultSetHeader, FieldPacket, OkPacket, ProcedureCallPacket, PoolConnection } from 'mysql2';
import db from '../db';

// getConnection 함수로 connection 객체 얻기
const connection = db.getConnection();
const performTransaction = db.performTransaction;

class Estimate {
  // category 튜플 추가
  static createBoxItem(newProduct: any, userId: string, result: (error: any, results: any) => void) {
    const query = "INSERT INTO estimateBox_product SET ?, estimateBox_id = (SELECT estimateBox_id FROM estimateBox WHERE users_id = ?)";
    const promises: Promise<any>[] = [];

    if (!Array.isArray(newProduct.product1)) {
      console.error("Invalid newProduct format. 'product1' should be an array.");
      result("Invalid newProduct format.", null);
      return;
    }

    newProduct.product1.forEach((product: any) => {
      const values = {
        product_id: product.product_id,
        category_id: product.category_id,
        parentsCategory_id: product.parentsCategory_id,
        estimateBox_price: product.estimateBox_price,
        estimateBox_discount: product.estimateBox_discount,
        estimateBox_cnt: product.estimateBox_cnt,
        estimateBox_selectedOption: product.estimateBox_selectedOption,
      };

      promises.push(new Promise((resolve, reject) => {
        connection.query(query, [values, userId], (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      }));
    });

    Promise.all(promises)
      .then((resArray) => {
        console.log('쿼리 실행 성공: ', resArray);
        result(null, resArray);
      })
      .catch((err) => {
        console.log('쿼리 실행 중 에러 발생: ', err);
        result(err, null);
      });
  }



  static list(user_id: string, currentPage: any, postsPerPage: number, result: (arg0: any, arg1: any) => void) {
    const offset = (currentPage - 1) * postsPerPage;
    const limit = postsPerPage;
    const query = `SELECT * FROM estimateBox JOIN estimateBox_product ON estimateBox.estimateBox_id = estimateBox_product.estimateBox_id JOIN product ON product.product_id = estimateBox_product.product_id WHERE estimateBox.users_id = ? ORDER BY estimateBox_product.estimateBox_product_id DESC LIMIT ?, ?`;
    // 전체 데이터 크기 확인을 위한 쿼리
    const countQuery = "SELECT COUNT(*) as totalRows FROM estimateBox JOIN estimateBox_product ON estimateBox.estimateBox_id = estimateBox_product.estimateBox_id WHERE estimateBox.users_id = ?";
    connection.query(countQuery, user_id, (countErr, countResult: any) => {
      if (countErr) {
        result(countErr, null);
        connection.releaseConnection;
        return;
      }
      const totalRows = countResult[0].totalRows;
      connection.query(query, [user_id, offset, limit], (err: QueryError | null, res: RowDataPacket[]) => {
        if (err) {
          console.log("에러 발생: ", err);
          result(err, null);
          connection.releaseConnection;
          return;
        }
        else {
          const totalPages = Math.ceil(totalRows / postsPerPage);
          const responseData = {
            data: res,
            currentPage: currentPage,
            totalPages: totalPages,
          }
          // 마지막 쿼리까지 모두 실행되면 결과를 반환합니다.
          console.log("상품이 갱신되었습니다: ", responseData);
          result(null, responseData);
          connection.releaseConnection;
          return;
        }
      });
    })
  }

  static manager(user_id: string, currentPage: any, postsPerPage: number, result: (arg0: any, arg1: any) => void) {
    const offset = (currentPage - 1) * postsPerPage;
    const limit = postsPerPage;
    const query = `
      SELECT estimate.*, 
      GROUP_CONCAT(
          JSON_OBJECT(
              'product_id', estimate_product.product_id,
              'product_title', product.product_title
          )
      ) AS products 
      FROM estimate 
      JOIN estimate_product 
      ON estimate.estimate_id = estimate_product.estimate_id 
      JOIN product 
      ON product.product_id = estimate_product.product_id 
      WHERE estimate.users_id = ? 
      GROUP BY estimate.estimate_id 
      ORDER BY estimate.estimate_date DESC LIMIT ?, ?
  `;

    // 전체 데이터 크기 확인을 위한 쿼리
    const countQuery = "SELECT COUNT(*) as totalRows FROM estimate WHERE estimate.users_id = ?";
    connection.query(countQuery, user_id, (countErr, countResult: any) => {
      if (countErr) {
        result(countErr, null);
        connection.releaseConnection;
        return;
      }
      const totalRows = countResult[0].totalRows;
      connection.query(query, [user_id, offset, limit], (err: QueryError | null, res: RowDataPacket[]) => {
        if (err) {
          console.log("에러 발생: ", err);
          result(err, null);
          connection.releaseConnection;
          return;
        }
        else {
          const totalPages = Math.ceil(totalRows / postsPerPage);
          const responseData = {
            data: res,
            currentPage: currentPage,
            totalPages: totalPages,
          }
          // 마지막 쿼리까지 모두 실행되면 결과를 반환합니다.
          console.log("상품이 갱신되었습니다: ", responseData);
          result(null, responseData);
          connection.releaseConnection;
          return;
        }
      });
    })
  }
  static findOne(data: any[], result: (arg0: any, arg1: any) => void) {
    let query;
    if (data[3] === null) {
      query = `
                SELECT * 
                FROM estimateBox_product
                WHERE estimateBox_product.estimateBox_id = (select estimateBox_id from estimateBox WHERE users_id = ?)
                    AND estimateBox_product.product_id = ?
                    AND estimateBox_product.category_id = ?`;
    } else {
      query = `
                SELECT * 
                FROM estimateBox_product
                WHERE estimateBox_product.estimateBox_id = (select estimateBox_id from estimateBox WHERE users_id = ?)
                    AND estimateBox_product.product_id = ?
                    AND estimateBox_product.category_id = ? 
                    AND estimateBox_product.estimateBox_selectedOption = ?`;
    }

    connection.query(query, [data[0], data[1], data[2], data[3] && data[3]], (err: QueryError | null, res: RowDataPacket[]) => {
      try {
        if (err) {
          console.log("에러 발생: ", err);
          result(err, null);
        } else {
          if (res.length > 0) {
            console.log("견적함에 중복된 상품이 있습니다.: ", res);
            result(null, res);
          } else {
            result(null, null);
          }
        }
      } finally {
        connection.releaseConnection; // Release the connection in a finally block
      }
    });
  }
  static create(newProduct: any, result: (arg0: any, arg1: any) => void) {
    performTransaction((connection: PoolConnection) => {
      const queries = [
        "INSERT INTO estimate SET ?",
        "INSERT INTO estimate_product SET ?",
      ];

      const results: (OkPacket | RowDataPacket[] | ResultSetHeader[] | RowDataPacket[][] | OkPacket[] | ProcedureCallPacket)[] = [];

      function executeQuery(queryIndex: number) {
        if (queryIndex < queries.length) {
          const query = queries[queryIndex];

          // 2번째 쿼리만 객체의 개수만큼 반복하기 위한 조건
          if (queryIndex === 1 && newProduct[0].product2 && newProduct[0].product2.length > 0) {
            // 2번째 쿼리가 모두 수행될 때 넘기도록 Promise화
            const promises = newProduct[0].product2.map((item: any) => {
              return new Promise((resolve, reject) => {
                connection.query(query, [item], (err, res) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve(res);
                  }
                });
              });
            });

            // 2번째 쿼리가 전부 수행되면 푸시 & 커밋
            Promise.all(promises)
              .then((resArray) => {
                results.push(resArray);
                executeQuery(queryIndex + 1); // Proceed to the next query
              })
              .catch((err) => {
                console.log(`쿼리 실행 중 에러 발생 (인덱스 ${queryIndex}): `, err);
                connection.rollback(() => {
                  result(err, null);
                  connection.release();
                });
              });
          } else {
            // 나머지 쿼리문 수행
            connection.query(query, [newProduct[0][`product${queryIndex + 1}`]], (err, res) => {
              if (err) {
                console.log(`쿼리 실행 중 에러 발생 (인덱스 ${queryIndex}): `, err);
                connection.rollback(() => {
                  result(err, null);
                  connection.release();
                });
              } else {
                results.push(res);
                executeQuery(queryIndex + 1);
              }
            });
          }
        } else {
          connection.commit((commitErr) => {
            if (commitErr) {
              console.log('커밋 중 에러 발생: ', commitErr);
              connection.rollback(() => {
                result(commitErr, null);
                connection.release();
              });
            } else {
              console.log('트랜잭션 성공적으로 완료: ', results);
              result(null, results);
              connection.release();
            }
          });
        }
      }

      executeQuery(0); // Start with the first query
    });
  }
  //가장 최근 회원의 견적 내역에서 견적 상품들 뽑아내기
  static findList(user_id: string, result: (arg0: any, arg1: any) => void) {
    const query = "SELECT * FROM estimate_product JOIN product ON estimate_product.product_id = product.product_id WHERE estimate_id = (SELECT estimate.estimate_id FROM estimate WHERE estimate.users_id = ? ORDER BY estimate.estimate_date DESC LIMIT 1)";
    connection.query(query, user_id, (err: QueryError | null, res: RowDataPacket[]) => {
      if (err) {
        console.log("에러 발생: ", err);
        result(err, null);
        connection.releaseConnection;
        return;
      }
      else {
        // 마지막 쿼리까지 모두 실행되면 결과를 반환합니다.
        console.log("상품이 갱신되었습니다: ", res);
        result(null, res);
        connection.releaseConnection;
        return;
      }
    });
  }
  //회원의 주문 내역에서 특정 조건의 주문 상품들 뽑아내기
  static findSelectEstimateList(user_id: string, estimate_id: string, result: (arg0: any, arg1: any) => void) {
    const query = "SELECT estimate_product.*, product.* FROM estimate JOIN estimate_product ON estimate.estimate_id = estimate_product.estimate_id JOIN product ON estimate_product.product_id = product.product_id WHERE estimate.users_id = ? AND estimate.estimate_id = ?";
    connection.query(query, [user_id, estimate_id], (err: QueryError | null, res: RowDataPacket[]) => {
      if (err) {
        console.log("에러 발생: ", err);
        result(err, null);
        connection.releaseConnection;
        return;
      }
      else {
        // 마지막 쿼리까지 모두 실행되면 결과를 반환합니다.
        console.log("주문 내역을 불러왔습니다: ", res);
        result(null, res);
        connection.releaseConnection;
        return;
      }
    });
  }
  //가장 최근 회원의 주문내역 1건 뽑아내기
  static findLastOne(userData: any, result: (arg0: any, arg1: any) => void) {
    const query = "SELECT * FROM estimate WHERE estimate.users_id = ? ORDER BY estimate.estimate_date DESC LIMIT 1";
    connection.query(query, userData, (err: QueryError | null, res: RowDataPacket[]) => {
      try {
        if (err) {
          console.log("에러 발생: ", err);
          result(err, null);
        } else {
          console.log("해당 유저의 가장 마지막 주문을 불렀습니다.: ", res[0]);
          result(null, res[0]);
        }
      } finally {
        connection.releaseConnection; // Release the connection in a finally block
      }
    });
  }

  static filter(users_id:any, newFilter: any, currentPage: number, postsPerPage: number, result: (arg0: any, arg1: any) => void) {
    const offset = (currentPage - 1) * postsPerPage;
    const limit = postsPerPage;

    const baseQuery = `
    SELECT estimate.*, 
    GROUP_CONCAT(
        JSON_OBJECT(
            'product_id', estimate_product.product_id,
            'product_title', product.product_title
        )
    ) AS products 
    FROM estimate 
    JOIN estimate_product 
    ON estimate.estimate_id = estimate_product.estimate_id 
    JOIN product 
    ON product.product_id = estimate_product.product_id 
  `;
  
  const countBaseQuery = `
    SELECT 
      COUNT(*) as totalRows     
    FROM estimate 
      JOIN estimate_product 
        ON estimate.estimate_id = estimate_product.estimate_id 
      JOIN product 
        ON product.product_id = estimate_product.product_id `;
  
  const condition = `WHERE estimate.users_id = ?`;
  
  const dateCondition = newFilter.raeDateType !== '' && newFilter.dateStart !== '' && newFilter.dateEnd !== '' ?
    `AND estimate.estimate_date BETWEEN DATE_FORMAT(?, "%Y-%m-%d") AND DATE_FORMAT(?, "%Y-%m-%d")`
    : '';

  const groupBy = "GROUP BY estimate.estimate_id";
  
  const orderBy = "ORDER BY estimate.estimate_date DESC";
  
  const query = `${baseQuery} ${condition} ${dateCondition} ${groupBy} ${orderBy} LIMIT ${offset}, ${limit}`;
  const countQuery = `${countBaseQuery} ${condition} ${dateCondition}`;
  
  const queryParams = [
    users_id,
  ];
  
  if (newFilter.dateStart !== '' && newFilter.dateEnd !== '') {
    queryParams.push(newFilter.dateStart, newFilter.dateEnd);
  }

    // 전체 데이터 크기 확인을 위한 쿼리
    connection.query(countQuery, queryParams, (countErr, countResult: any) => {
      if (countErr) {
        result(countErr, null);
        connection.releaseConnection;
        return;
      }
      const totalRows = countResult[0].totalRows;

      connection.query(query, queryParams, (err: QueryError | null, res: RowDataPacket[]) => {
        if (err) {
          console.log("에러 발생: ", err);
          result(err, null);
          connection.releaseConnection;
          return;
        } else {
          console.log(query);
          console.log(queryParams);
          const totalPages = Math.ceil(totalRows / postsPerPage);

          const responseData = {
            data: res,
            currentPage: currentPage,
            totalPages: totalPages,
          }
          // 마지막 쿼리까지 모두 실행되면 결과를 반환합니다.
          console.log("상품이 갱신되었습니다: ", responseData);
          result(null, responseData);
          connection.releaseConnection;
          return;
        }
      });
    });
  }

  static deleteByIds(product: number[], result: (error: any, response: any) => void) {
    const query = "DELETE FROM estimateBox_product WHERE estimateBox_product_id IN (?)"
    connection.query(query, [product], (err, res) => {
      if (err) {
        console.log(`쿼리 실행 중 에러 발생: `, err);
        result(err, null);
        connection.releaseConnection;
      } else {
        console.log('성공적으로 삭제 완료: ', res);
        result(null, res);
        connection.releaseConnection;
      }
    })
  }
}

export = Estimate;