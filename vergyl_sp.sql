DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "add_address"(
    IN p_user_id INT,
    IN p_address_line VARCHAR(255),
    IN p_city VARCHAR(100),
    IN p_state VARCHAR(100),
    IN p_zip_code VARCHAR(20),
    IN p_country VARCHAR(100)
)
BEGIN
    INSERT INTO addresses (user_id, address_line, city, state, zip_code, country, created_at)
    VALUES (p_user_id, p_address_line, p_city, p_state, p_zip_code, p_country, NOW());
    
    SELECT LAST_INSERT_ID() as address_id;
    
    SELECT * FROM addresses WHERE address_id = LAST_INSERT_ID();
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "check_social_user"(
    IN p_social_id VARCHAR(255),
    IN p_login_type VARCHAR(20)
)
BEGIN
    SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.role,u.size_preferences
    FROM users u
    JOIN social_users su ON u.user_id = su.user_id
    WHERE su.social_id = p_social_id 
    AND su.social_type = p_login_type;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "check_user_exists"(
    IN p_value VARCHAR(255),
    IN p_login_type VARCHAR(20)
)
BEGIN
    SELECT user_id, email, phone, role
    FROM users
    WHERE (p_login_type = 'email' AND email = p_value)
       OR (p_login_type = 'phone' AND phone = p_value);
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "create_order"(
    IN p_user_id INT,
    IN p_address_id INT,
    IN p_subtotal DECIMAL(10,2),
    IN p_service_charge DECIMAL(10,2),
    IN p_delivery_charge DECIMAL(10,2),
    IN p_total DECIMAL(10,2),
    IN p_order_items JSON -- Array of items (either custom or predefined products)
)
BEGIN
    -- Declare variables
    DECLARE order_id_ INT;
    DECLARE item_count INT DEFAULT 0;
    DECLARE item_json JSON;
    DECLARE is_custom_product_ TINYINT;
    DECLARE product_id INT;
    DECLARE product_request_id INT;
    DECLARE request_master_id_ INT;
    DECLARE quantity INT;
    DECLARE price DECIMAL(10,2);
    DECLARE approval_count INT;
	DECLARE approval_id_ INT;
    DECLARE unapproved_products TEXT DEFAULT ''; -- Store rejected products
    DECLARE approved_requests TEXT DEFAULT ''; -- Store approved product request IDs
    DECLARE affected_request_masters TEXT DEFAULT ''; -- Store affected request_master_ids

    SET item_count = JSON_LENGTH(p_order_items);

    -- Insert new order
    INSERT INTO orders (user_id, address_id, subtotal, service_charge, delivery_charge, total, status, order_status_id,created_at)
    VALUES (p_user_id, p_address_id, p_subtotal, p_service_charge, p_delivery_charge, p_total, 'Pending',1, NOW());

    -- Get order ID
    SET order_id_ = LAST_INSERT_ID();

    WHILE item_count > 0 DO
        SET item_json = JSON_EXTRACT(p_order_items, CONCAT('$[', item_count - 1, ']'));

        -- Extract item details
        SET is_custom_product_ = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.is_custom_product'));
        SET product_id = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_id'));
        SET product_request_id = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_request_id'));
        SET quantity = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.quantity'));
        SET price = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.price'));
		SET approval_id_ = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.approval_id'));

        -- Handle custom products (check approval)
        IF is_custom_product_ = 1 THEN
            -- Check if admin approved the product request
            SELECT COUNT(*) INTO approval_count 
            FROM product_request_approvals 
            WHERE request_id = product_request_id;

            IF approval_count > 0 THEN
                -- Get the request_master_id for tracking
                SELECT request_master_id INTO request_master_id_
                FROM product_requests 
                WHERE request_id = product_request_id;

                -- Insert approved custom product into order_items
                INSERT INTO order_items (order_id, is_custom_product, product_request_id, quantity, price,approval_id)
                VALUES (order_id_, TRUE, product_request_id, quantity, price,approval_id_);

                -- Store approved request ID for batch update
                SET approved_requests = CONCAT(approved_requests, product_request_id, ',');

                -- Store affected request_master_id for batch update
                SET affected_request_masters = CONCAT(affected_request_masters, request_master_id_, ',');
            ELSE
                -- Store unapproved product name in list
                SET unapproved_products = CONCAT(unapproved_products, (SELECT product_name FROM product_requests WHERE request_id = product_request_id), ', ');
            END IF;
        ELSE
            -- Insert predefined product into order_items
            INSERT INTO order_items (order_id, is_custom_product, product_id, quantity, price,approval_id)
            VALUES (order_id_, 0, product_id, quantity, price,approval_id_);
        END IF;

        -- Decrease item count
        SET item_count = item_count - 1;
    END WHILE;

    -- Batch update product requests to 'Completed' (only if there are approved ones)
    IF LENGTH(approved_requests) > 0 THEN
        SET @sql = CONCAT('UPDATE product_requests SET status = ''Completed'', updated_at = NOW() WHERE request_id IN (', approved_requests, '0)');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;

    -- Batch update request_master to 'Completed' if any of its products were ordered
    IF LENGTH(affected_request_masters) > 0 THEN
        SET @sql2 = CONCAT('UPDATE product_request_master SET status = ''Completed'', updated_at = NOW() WHERE request_master_id IN (', affected_request_masters, '0)');
        PREPARE stmt2 FROM @sql2;
        EXECUTE stmt2;
        DEALLOCATE PREPARE stmt2;
    END IF;

    -- Log details into datalog table
    INSERT INTO datalog (order_id, affected_request_masters, approved_requests, created_at)
    VALUES (order_id_, affected_request_masters, approved_requests, NOW());

    -- Insert into order history
    INSERT INTO order_history (order_id, status, updated_at)
    VALUES (order_id_, 'Pending', NOW());

    -- Return order ID
    SELECT order_id_ AS order_id;

    -- Return blocked/unapproved products if any
    IF LENGTH(unapproved_products) > 0 THEN
        SELECT unapproved_products AS blocked_products;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "create_product_request"(
    IN p_user_id INT,
    IN p_address_id INT,
    IN p_product_requests JSON 
)
BEGIN
    DECLARE master_id INT;
    DECLARE item_count INT DEFAULT 0;
    DECLARE item_json JSON;
    DECLARE p_product_name VARCHAR(255);
    DECLARE p_description TEXT;
    DECLARE p_requested_size VARCHAR(100);
    DECLARE p_requested_color VARCHAR(100);
    DECLARE p_image TEXT;
    
    -- Get 'Pending' status ID
    DECLARE pending_status_id INT;
    SELECT request_status_id INTO pending_status_id FROM request_status WHERE status_name = 'Pending';

    -- Step 1: Insert into product_request_master (added address_id)
    INSERT INTO product_request_master (user_id, address_id, status, request_status_id, created_at, updated_at)
    VALUES (p_user_id, p_address_id, 'Pending', pending_status_id, NOW(), NOW());

    -- Get the inserted master request ID
    SET master_id = LAST_INSERT_ID();
    SET item_count = JSON_LENGTH(p_product_requests);

    -- Step 2: Insert product requests
    WHILE item_count > 0 DO
        SET item_json = JSON_EXTRACT(p_product_requests, CONCAT('$[', item_count - 1, ']'));

        -- Extract JSON data
        SET p_product_name = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_name'));
        SET p_description = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.description'));
        SET p_requested_size = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.requested_size'));
        SET p_requested_color = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.requested_color'));
        SET p_image = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.image'));

        -- Insert into product_requests
        INSERT INTO product_requests (
            request_master_id, product_name, description, requested_size, 
            requested_color, image, status, request_status_id, created_at, updated_at
        ) 
        VALUES (
            master_id, p_product_name, p_description, p_requested_size, 
            p_requested_color, p_image, 'Pending', pending_status_id, NOW(), NOW()
        );

        -- Decrement count
        SET item_count = item_count - 1;
    END WHILE;

    -- Return master request ID
    SELECT master_id AS request_master_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "create_social_user"(
    IN p_social_id VARCHAR(255),
    IN p_email VARCHAR(255),
    IN p_name VARCHAR(255),
    IN p_login_type VARCHAR(20),
	IN p_size_preferences VARCHAR(255)

)
BEGIN
    DECLARE v_user_id INT;
    

    
    -- First check if social user exists
    SELECT u.user_id INTO v_user_id
    FROM users u
    JOIN social_users su ON u.user_id = su.user_id
    WHERE su.social_id = p_social_id 
    AND su.social_type = p_login_type;
    
    -- If not found, check if email exists
    IF v_user_id IS NULL THEN
        SELECT user_id INTO v_user_id
        FROM users
        WHERE email = p_email;
    END IF;
    
    -- If still not found, create new user
    IF v_user_id IS NULL THEN
        INSERT INTO users (
            name,
            email,
            role,
            created_at,
            size_preferences
        )
        VALUES (
            p_name,
            p_email,
            'customer',
            CURRENT_TIMESTAMP,
            p_size_preferences
        );
        
        SET v_user_id = LAST_INSERT_ID();
    END IF;
    
    -- Insert or update social user entry
    INSERT INTO social_users (
        user_id,
        social_id,
        social_type
    )
    VALUES (
        v_user_id,
        p_social_id,
        p_login_type
    )
    ON DUPLICATE KEY UPDATE
        user_id = v_user_id;
    
    -- Return user details
    SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.role
    FROM users u
    WHERE u.user_id = v_user_id;
    

END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "create_user"(
    IN p_email VARCHAR(255),
    IN p_phone VARCHAR(20),
    IN p_role VARCHAR(20),
	IN p_size_preferences VARCHAR(255),
	IN p_name VARCHAR(20)

)
BEGIN
    INSERT INTO users (
        email,
        phone,
        role,
        created_at,
        size_preferences,
        name
    )
    VALUES (
        p_email,
        p_phone,
        p_role,
        CURRENT_TIMESTAMP,
        p_size_preferences,
        p_name
    );
    
    SELECT LAST_INSERT_ID() as user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "delete_address"(
    IN p_address_id INT,
    IN p_user_id INT
)
BEGIN
    update addresses  set Delete_Status=1
    WHERE address_id = p_address_id AND user_id = p_user_id;
    
    SELECT ROW_COUNT() as deleted;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "delete_order"(
    IN p_order_id INT,
    IN p_Action_By Int
)
BEGIN

	   UPDATE orders
    SET status = 'Canceled', 
        order_status_id = 5, 
        updated_at = NOW()
    WHERE order_id = p_order_id AND delete_status = 0;

    -- Insert into order_history
    INSERT INTO order_history (order_id, status, order_status_id, updated_by, updated_at)
    VALUES (p_order_id,  'Canceled', 5, p_Action_By, NOW());
/*
    UPDATE orders
    SET delete_status = 1
    WHERE order_id = p_order_id;
    
    UPDATE order_items
    SET delete_status = 1
    WHERE order_id = p_order_id;
    */
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_addresses"(
    IN p_user_id INT
)
BEGIN
    SELECT * FROM addresses WHERE user_id = p_user_id and Delete_Status=0;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_all_orders"(
    IN p_status VARCHAR(50),
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    -- Get order details with image array
    SELECT 
        o.order_id,
        o.user_id,
        u.name AS user_name,  -- User Name
        o.address_id,
        a.address_line,
        a.city,
        a.state,
        a.zip_code,
        a.country,
        o.subtotal,
        o.service_charge,
        o.delivery_charge,
        o.total,
        o.status,
        os.status_name AS order_status,
        o.scheduled_time,
        o.created_at,

        -- JSON Array for Order Images
        CAST(
            COALESCE((
                SELECT JSON_ARRAYAGG(
                    IF(oi.is_custom_product = 1, pr.image, p.image) -- Fetch product or custom product image
                )
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN product_requests pr ON oi.product_request_id = pr.request_id
                WHERE oi.order_id = o.order_id
            ), '[]') AS JSON
        ) AS order_images -- Array of Images

    FROM orders o
    LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
    LEFT JOIN users u ON o.user_id = u.user_id
    LEFT JOIN addresses a ON o.address_id = a.address_id
    WHERE 
        (p_status IS NULL OR os.status_name = p_status)
        AND (p_start_date IS NULL OR o.created_at >= p_start_date)
        AND (p_end_date IS NULL OR o.created_at <= p_end_date)
        AND o.delete_status = 0
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
    LIMIT p_limit OFFSET p_offset;

    -- Query to get the total sum of all orders
    SELECT SUM(o.total) AS total_amount
    FROM orders o
    LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
    WHERE 
        (p_status IS NULL OR os.status_name = p_status)  
        AND (p_start_date IS NULL OR o.created_at >= p_start_date)  
        AND (p_end_date IS NULL OR o.created_at <= p_end_date)  
        AND o.delete_status = 0;  
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_all_product_requests"(
    IN p_status VARCHAR(50),
    IN p_request_master_id INT
)
BEGIN
    IF p_request_master_id = 0 THEN
        -- Retrieve all product request masters with only one product request
      
	SELECT 
		    prm.request_master_id,
			prm.status AS master_status,
			u.name AS customer_name, 
			u.email AS customer_email,
			a.address_line,
			a.city,
			a.state,
			a.zip_code,
			a.country,
             a.address_id,

				-- JSON Array of Images from product_requests
				CAST(
					COALESCE((
						SELECT JSON_ARRAYAGG(pr.image)
						FROM product_requests pr
						WHERE pr.request_master_id = prm.request_master_id
						  AND pr.delete_status = 0
					), '[]') AS JSON
				) AS product_images

  
        FROM product_request_master prm
        LEFT JOIN users u ON prm.user_id = u.user_id
        LEFT JOIN addresses a ON prm.address_id = a.address_id
        LEFT JOIN product_requests pr 
            ON prm.request_master_id = pr.request_master_id
        WHERE    (p_status IS NULL OR EXISTS (
                SELECT 1 FROM product_requests pr 
                WHERE pr.request_master_id = prm.request_master_id
                  AND pr.status = p_status
              ))
          AND prm.delete_status = 0
          GROUP BY prm.request_master_id
            order by  prm.request_master_id desc;
        
    ELSE
        -- Retrieve all product requests under the selected master request
          SELECT 
			prm.request_master_id,
            prm.status AS master_status,
            prm.created_at AS master_created_at,
            u.name AS customer_name, 
            u.email AS customer_email,
            a.address_line,
            a.city,
            a.state,
            a.zip_code,
            a.country,
            prm.address_id,

    -- JSON Array for Product Requests
    CAST(
        COALESCE((
            SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                    'request_id', pr.request_id,
                    'product_name', pr.product_name,
                    'description', pr.description,
                    'requested_size', pr.requested_size,
                    'requested_color', pr.requested_color,
                    'status', pr.status,
                    'request_status_id', pr.request_status_id,
                    'image', pr.image,

                    -- Nested JSON Array for Approvals
                    'approvals', (
                        SELECT JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'approved_size', pa.approved_size,
                                'approved_color', pa.approved_color,
                                'approved_price', pa.approved_price,
                                'approval_id', pa.approval_id
                            )
                        ) 
                        FROM product_request_approvals pa
                        WHERE pa.request_id = pr.request_id
                    )
                )
            ) 
            FROM product_requests pr 
            WHERE pr.request_master_id = prm.request_master_id
              AND pr.delete_status = 0
        ), '[]') AS JSON
    ) AS product_requests

        FROM product_request_master prm
        LEFT JOIN users u ON prm.user_id = u.user_id
        LEFT JOIN addresses a ON prm.address_id = a.address_id
        LEFT JOIN product_requests pr 
            ON prm.request_master_id = pr.request_master_id
        WHERE prm.request_master_id = p_request_master_id
          AND (p_status IS NULL OR pr.status = p_status)
          AND prm.delete_status = 0
          GROUP BY prm.request_master_id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_customer_details"(
    IN p_customer_id INT
)
BEGIN
    -- Customer details
    SELECT 
        u.*,
        COUNT(DISTINCT o.order_id) as total_orders,
        SUM(o.total) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.user_id = o.user_id
    WHERE u.user_id = p_customer_id
    GROUP BY u.user_id;

    -- Recent orders
    SELECT 
        o.*,
        COUNT(oi.order_item_id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.user_id = p_customer_id
    GROUP BY o.order_id
    ORDER BY o.created_at DESC
    LIMIT 10;

    -- Addresses
    SELECT * FROM addresses 
    WHERE user_id = p_customer_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_customer_product_requests"(
    IN p_user_id INT,
    IN p_status VARCHAR(50),
    IN p_request_master_id INT
)
BEGIN
    IF p_request_master_id = 0 THEN
		SELECT 
				prm.request_master_id,
				prm.status AS master_status,
				prm.created_at AS mastzer_created_at,
				a.address_line,
				a.city,
				a.state,
				a.zip_code,
				a.country,

				-- JSON Array of Images from product_requests
				CAST(
					COALESCE((
						SELECT JSON_ARRAYAGG(pr.image)
						FROM product_requests pr
						WHERE pr.request_master_id = prm.request_master_id
						  AND pr.delete_status = 0
					), '[]') AS JSON
				) AS product_images

			FROM product_request_master prm
			JOIN product_requests pr ON pr.request_master_id = prm.request_master_id
			LEFT JOIN addresses a ON prm.address_id = a.address_id
			WHERE prm.user_id = p_user_id
			  AND (p_status IS NULL OR EXISTS (
					SELECT 1 FROM product_requests pr 
					WHERE pr.request_master_id = prm.request_master_id
					  AND pr.status = p_status
				  ))
			  AND prm.delete_status = 0
			GROUP BY prm.request_master_id
            order by  prm.request_master_id desc;

        
    ELSE
        -- Retrieve all product requests under the selected master request
        SELECT 
            prm.request_master_id,
            prm.status AS master_status,
            prm.created_at AS master_created_at,
            u.name AS customer_name, 
            u.email AS customer_email,
            a.address_line,
            a.city,
            a.state,
            a.zip_code,
            a.country,
            prm.address_id,

            -- JSON Array for Product Requests
            CAST(
                COALESCE((
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'request_id', pr.request_id,
                            'product_name', pr.product_name,
                            'description', pr.description,
                            'requested_size', pr.requested_size,
                            'requested_color', pr.requested_color,
                            'status', pr.status,
                            'request_status_id', pr.request_status_id,
                            'image', pr.image,

                            -- Nested JSON Array for Approvals
                            'approvals', (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'approved_size', pa.approved_size,
                                        'approved_color', pa.approved_color,
                                        'approved_price', pa.approved_price,
										'approval_id', pa.approval_id
                                    )
                                ) 
                                FROM product_request_approvals pa
                                WHERE pa.request_id = pr.request_id
                            )
                        )
                    ) 
                    FROM product_requests pr 
                    WHERE pr.request_master_id = prm.request_master_id
                      AND pr.delete_status = 0
                ), '[]') AS JSON
            ) AS product_requests

        FROM product_request_master prm
        LEFT JOIN users u ON prm.user_id = u.user_id
        LEFT JOIN addresses a ON prm.address_id = a.address_id
        WHERE prm.user_id = p_user_id
          AND prm.request_master_id = p_request_master_id
          AND (p_status IS NULL OR EXISTS (
                SELECT 1 FROM product_requests pr 
                WHERE pr.request_master_id = prm.request_master_id
                  AND pr.status = p_status
              ))
          AND prm.delete_status = 0
        GROUP BY prm.request_master_id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_customer_reports"(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    -- Top customers
    SELECT 
        u.user_id,
        u.name,
        u.email,
        COUNT(DISTINCT o.order_id) as total_orders,
        SUM(o.total) as total_spent
    FROM users u
    JOIN orders o ON u.user_id = o.user_id
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY u.user_id
    ORDER BY total_spent DESC
    LIMIT 10;

    -- New customers
    SELECT 
        DATE(u.created_at) as date,
        COUNT(*) as new_customers
    FROM users u
    WHERE u.created_at BETWEEN p_start_date AND p_end_date
    AND u.role = 'customer'
    GROUP BY DATE(u.created_at)
    ORDER BY date;

    -- Customer retention
    SELECT 
        COUNT(DISTINCT CASE WHEN order_count > 1 THEN u.user_id END) as returning_customers,
        COUNT(DISTINCT u.user_id) as total_customers,
        (COUNT(DISTINCT CASE WHEN order_count > 1 THEN u.user_id END) / COUNT(DISTINCT u.user_id)) * 100 as retention_rate
    FROM users u
    JOIN (
        SELECT user_id, COUNT(*) as order_count
        FROM orders
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY user_id
    ) order_counts ON u.user_id = order_counts.user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_customers"(
    IN p_search VARCHAR(255),
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    -- Get total count first
    SELECT COUNT(DISTINCT u.user_id) as total
    FROM users u
    WHERE u.role = 'customer'
    AND (p_search IS NULL 
         OR u.name LIKE CONCAT('%', p_search, '%')
         OR u.email LIKE CONCAT('%', p_search, '%')
         OR u.phone LIKE CONCAT('%', p_search, '%'));

    -- Get paginated results with aggregates
    SELECT 
        u.*,
        COUNT(DISTINCT o.order_id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.user_id = o.user_id
    WHERE u.role = 'customer'
    AND (p_search IS NULL 
         OR u.name LIKE CONCAT('%', p_search, '%')
         OR u.email LIKE CONCAT('%', p_search, '%')
         OR u.phone LIKE CONCAT('%', p_search, '%'))
    GROUP BY u.user_id
    ORDER BY total_spent DESC
    LIMIT p_limit OFFSET p_offset;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_order_details"(
    IN p_order_id INT
)
BEGIN
    -- Fetch main order details
    SELECT 
        o.order_id,
        o.user_id,
        o.address_id,
        o.subtotal,
        o.service_charge,
        o.delivery_charge,
        o.total,
        o.status,
        os.status_name AS order_status, -- Fetch status name
        o.scheduled_time,
        o.created_at
    FROM orders o
    LEFT JOIN order_status os ON o.order_status_id = os.order_status_id  -- Join for status name
    WHERE o.order_id = p_order_id
      AND o.delete_status = 0;  -- Exclude deleted orders

    -- Fetch associated order items
    SELECT 
        oi.order_item_id,
        oi.product_id,
        oi.is_custom_product,
        oi.product_request_id,
        oi.quantity,
        oi.price,
        oi.subtotal AS item_subtotal,
        -- Custom or predefined product details
        CASE 
            WHEN oi.is_custom_product = 1 THEN 
                JSON_OBJECT(
                    'request_id', pr.request_id,
                    'user_id', prm.user_id,
                    'product_name', pr.product_name,
                    'description', pr.description,
                    'requested_size', pr.requested_size,
                    'requested_color', pr.requested_color,
                    'status', prm.status,   -- Status from request master
                    'image', pr.image,
					'approval_id', pa.approval_id,
                    'approved_by', pa.approved_by,
                    'approved_size', pa.approved_size,
                    'approved_color', pa.approved_color,
                    'approved_price', pa.approved_price
                )
            ELSE 
                JSON_OBJECT(
                    'product_id', p.product_id,
                    'name', p.name,
                    'category', p.category,
                    'price', p.price
                )
        END AS product_details
    FROM order_items oi
    LEFT JOIN product_requests pr ON oi.product_request_id = pr.request_id AND oi.is_custom_product = 1 -- Custom products
    LEFT JOIN product_request_master prm ON pr.request_master_id = prm.request_master_id  -- Join request master for status
    LEFT JOIN product_request_approvals pa ON oi.approval_id = pa.approval_id  -- Join approvals
    LEFT JOIN products p ON oi.product_id = p.product_id AND oi.is_custom_product = 0 -- Predefined products
    WHERE oi.order_id = p_order_id
      AND oi.delete_status = 0;  -- Exclude deleted items
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_order_history"(
    IN p_order_id INT
)
BEGIN
    -- Retrieve the order history based on order_id
    SELECT oh.history_id, 
           oh.status, 
           oh.order_status_id,
           oh.updated_at, 
           o.user_id,
           u.name AS customer_name
    FROM order_history oh
    JOIN orders o ON oh.order_id = o.order_id
    LEFT JOIN users u ON o.user_id = u.user_id
    WHERE oh.order_id = p_order_id 
    ORDER BY oh.updated_at ASC; -- Sort by updated_at to get the chronological order of status changes
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_order_reports"(
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_status VARCHAR(50)
)
BEGIN
    -- Summary
    SELECT 
        COUNT(*) as total_orders,
        SUM(total) as total_revenue,
        AVG(total) as average_order_value,
        COUNT(DISTINCT user_id) as unique_customers
    FROM orders
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_status IS NULL OR status = p_status);

    -- Daily breakdown
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total) as daily_revenue,
        status
    FROM orders
    WHERE created_at BETWEEN p_start_date AND p_end_date
    AND (p_status IS NULL OR status = p_status)
    GROUP BY DATE(created_at), status
    ORDER BY date DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_orders"(
    IN p_user_id INT
)
BEGIN
    -- Get orders for a specific user with only images
    SELECT 
        o.order_id,
        o.address_id,
        a.address_line,
        a.city,
        a.state,
        a.zip_code,
        a.country,
        o.subtotal,
        o.service_charge,
        o.delivery_charge,
        o.total,
        o.status,
        os.status_name AS order_status,
        o.created_at,

        -- JSON Array for Order Images
        CAST(
            COALESCE((
                SELECT JSON_ARRAYAGG(
                    IF(oi.is_custom_product = 1, pr.image, p.image) -- Fetch product or custom product image
                )
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN product_requests pr ON oi.product_request_id = pr.request_id
                WHERE oi.order_id = o.order_id
            ), '[]') AS JSON
        ) AS order_images -- Array of Images

    FROM orders o
    LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
    LEFT JOIN addresses a ON o.address_id = a.address_id
    WHERE o.user_id = p_user_id
      AND o.delete_status = 0
    GROUP BY o.order_id
    ORDER BY o.created_at DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_product_reports"(
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    -- Best selling products
    SELECT 
        p.product_id,
        p.name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price) as total_revenue
    FROM products p
    JOIN order_items oi ON p.product_id = oi.product_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY p.product_id
    ORDER BY total_quantity DESC
    LIMIT 10;

    -- Low stock products
    SELECT 
        p.*
    FROM products p
    WHERE p.stock <= 10
    ORDER BY p.stock ASC;

    -- Category performance
    SELECT 
        p.category as category_name,
        COUNT(DISTINCT o.order_id) as total_orders,
        SUM(oi.quantity) as total_items_sold,
        SUM(oi.quantity * oi.price) as total_revenue
    FROM products p
    JOIN order_items oi ON p.product_id = oi.product_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY p.category
    ORDER BY total_revenue DESC;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_profile"(
    IN p_user_id INT
)
BEGIN
    SELECT *
    FROM users
    WHERE user_id = p_user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_revenue_reports"(
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_group_by VARCHAR(20)
)
BEGIN
    -- Summary
    SELECT 
        SUM(total) as total_revenue,
        COUNT(*) as total_orders,
        SUM(total)/COUNT(*) as average_order_value
    FROM orders
    WHERE created_at BETWEEN p_start_date AND p_end_date;

    -- Revenue breakdown
    CASE p_group_by
        WHEN 'daily' THEN
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders,
                SUM(total) as revenue
            FROM orders
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY DATE(created_at)
            ORDER BY date;
        WHEN 'weekly' THEN
            SELECT 
                YEARWEEK(created_at) as week,
                COUNT(*) as orders,
                SUM(total) as revenue
            FROM orders
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY YEARWEEK(created_at)
            ORDER BY week;
        WHEN 'monthly' THEN
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as orders,
                SUM(total) as revenue
            FROM orders
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month;
    END CASE;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_user_by_id"(
    IN p_user_id INT
)
BEGIN
    SELECT user_id, name, email, phone, role,size_preferences
    FROM users
    WHERE user_id = p_user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "handle_product_request"(
    IN p_request_id INT,
    IN p_admin_id INT,
    IN p_action VARCHAR(10),           
    IN p_approval_options JSON         
)
BEGIN
    DECLARE affected_rows INT DEFAULT 0;
    DECLARE request_exists INT DEFAULT 0;
    DECLARE option_count INT DEFAULT 0;
    DECLARE option_json JSON;
    DECLARE approved_status_id INT;
    DECLARE rejected_status_id INT;
    
    -- Get status IDs
    SELECT request_status_id INTO approved_status_id FROM request_status WHERE status_name = 'Approved';
    SELECT request_status_id INTO rejected_status_id FROM request_status WHERE status_name = 'Rejected';

    -- Check if the request exists
    SELECT COUNT(*) INTO request_exists FROM product_requests WHERE request_id = p_request_id;

    -- If request does not exist, signal an error
    IF request_exists = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Request ID not found.';
    END IF;

    -- If action is approve
    IF p_action = 'approve' THEN
        -- Update the product request status
        UPDATE product_requests
        SET status = 'Approved',
            request_status_id = approved_status_id, 
            updated_at = CURRENT_TIMESTAMP
        WHERE request_id = p_request_id;

        -- Delete existing approval records for this request before inserting new ones
        DELETE FROM product_request_approvals WHERE request_id = p_request_id;

        -- Process multiple approval options
        SET option_count = JSON_LENGTH(p_approval_options);

        WHILE option_count > 0 DO
            SET option_json = JSON_EXTRACT(p_approval_options, CONCAT('$[', option_count - 1, ']'));

            -- Insert approval details into `product_request_approvals`
            INSERT INTO product_request_approvals (
                request_id, approved_by, approved_size, approved_color, approved_price, created_at, updated_at
            ) VALUES (
                p_request_id, 
                p_admin_id, 
                JSON_UNQUOTE(JSON_EXTRACT(option_json, '$.size')),
                JSON_UNQUOTE(JSON_EXTRACT(option_json, '$.color')),
                JSON_UNQUOTE(JSON_EXTRACT(option_json, '$.price')),
                NOW(), 
                NOW()
            );

            SET option_count = option_count - 1;
        END WHILE;

        SET affected_rows = ROW_COUNT();
        
    -- If action is reject
    ELSEIF p_action = 'reject' THEN
        -- Update the product request status
        UPDATE product_requests
        SET status = 'Rejected',
            request_status_id = rejected_status_id, 
            updated_at = CURRENT_TIMESTAMP
        WHERE request_id = p_request_id;

        SET affected_rows = ROW_COUNT();

    -- Invalid action handling
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid action. Please specify "approve" or "reject".';
    END IF;

    -- Return the request_id and affected rows count
    SELECT p_request_id AS request_id, affected_rows AS updated_count;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "login"(
    IN p_email VARCHAR(255)
)
BEGIN
    SELECT user_id, name, email, phone, password, role
    FROM users 
    WHERE email = p_email;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "reset_password"(
    IN p_email VARCHAR(255),
    IN p_password VARCHAR(255)
)
BEGIN
    UPDATE users 
    SET password = p_password,
        updated_at = NOW()
    WHERE email = p_email;
    
    SELECT ROW_COUNT() as updated;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "save_otp"(
    IN p_user_id INT,
    IN p_otp VARCHAR(6)
)
BEGIN
    INSERT INTO user_otps (user_id, otp)
    VALUES (p_user_id, p_otp)
    ON DUPLICATE KEY UPDATE
        otp = p_otp,
        is_used = 0,
        created_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "signup"(
    IN p_name VARCHAR(255),
    IN p_email VARCHAR(255),
    IN p_phone VARCHAR(15),
    IN p_password VARCHAR(255),
    IN p_role ENUM('customer', 'admin')
)
BEGIN
    INSERT INTO users (name, email, phone, password, role, created_at)
    VALUES (p_name, p_email, p_phone, p_password, p_role, NOW());
    
    SELECT LAST_INSERT_ID() as user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "update_address"(
    IN p_address_id INT,
    IN p_user_id INT,
    IN p_address_line VARCHAR(255),
    IN p_city VARCHAR(100),
    IN p_state VARCHAR(100),
    IN p_zip_code VARCHAR(20),
    IN p_country VARCHAR(100)
)
BEGIN
    UPDATE addresses 
    SET address_line = p_address_line,
        city = p_city,
        state = p_state,
        zip_code = p_zip_code,
        country = p_country
        WHERE address_id = p_address_id AND user_id = p_user_id;
    
    SELECT ROW_COUNT() as updated;
    
    IF ROW_COUNT() > 0 THEN
        SELECT * FROM addresses WHERE address_id = p_address_id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "update_order_delivery"(
    IN p_order_id INT,
    IN p_user_id INT,
    IN p_delivery_time DATETIME
)
BEGIN
    UPDATE orders
    SET scheduled_time = p_delivery_time,
        updated_at = NOW()
    WHERE order_id = p_order_id AND user_id = p_user_id;
    
    SELECT ROW_COUNT() as updated;
    
    IF ROW_COUNT() > 0 THEN
        SELECT * FROM orders WHERE order_id = p_order_id;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "update_order_status"(
    IN p_order_id INT,
    IN p_new_status VARCHAR(50),  -- Pass status name instead of ENUM
    IN p_updated_by INT
)
BEGIN
    DECLARE v_order_status_id INT;

    -- Get the corresponding order_status_id
    SELECT order_status_id INTO v_order_status_id 
    FROM order_status 
    WHERE status_name = p_new_status;

    -- If status not found, return an error
    IF v_order_status_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status provided';
    END IF;

    -- Update the order's status and status ID
    UPDATE orders
    SET status = p_new_status, 
        order_status_id = v_order_status_id, 
        updated_at = NOW()
    WHERE order_id = p_order_id AND delete_status = 0;

    -- Insert into order_history
    INSERT INTO order_history (order_id, status, order_status_id, updated_by, updated_at)
    VALUES (p_order_id, p_new_status, v_order_status_id, p_updated_by, NOW());

    -- Return updated order details
    SELECT p_order_id AS order_id, p_new_status AS status;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "update_profile"(
   IN p_user_id INT,
    IN p_name VARCHAR(255),
    IN p_last_name VARCHAR(255),
    IN p_email VARCHAR(255),
    IN p_phone VARCHAR(20),
    IN p_size_preferences VARCHAR(255)
)
BEGIN
    DECLARE email_exists INT;
    DECLARE phone_exists INT;
    
    -- Check if email exists for other users
    SELECT COUNT(*) INTO email_exists
    FROM users 
    WHERE email = p_email 
    AND user_id != p_user_id 
    AND Delete_Status = 0;
    
    -- Check if phone exists for other users
    SELECT COUNT(*) INTO phone_exists
    FROM users 
    WHERE phone = p_phone 
    AND user_id != p_user_id 
    AND Delete_Status = 0;

    
    IF email_exists > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Email already exists';
    ELSEIF phone_exists > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Phone number already exists';
    ELSE
        UPDATE users 
        SET name = p_name,
            last_name = p_last_name,
            email = p_email,
            phone = p_phone,
            size_preferences = p_size_preferences,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        SELECT ROW_COUNT() as updated;
        
        IF ROW_COUNT() > 0 THEN
            SELECT user_id, name, last_name, email, phone, role, size_preferences
            FROM users
            WHERE user_id = p_user_id
			AND Delete_Status = 0;
        END IF;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "update_user_size_preferences"(
    IN p_user_id INT,
    IN p_size_preferences VARCHAR(255)
)
BEGIN
    UPDATE users 
    SET size_preferences = p_size_preferences
    WHERE user_id = p_user_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "verify_otp"(
    IN p_user_id INT,
    IN p_otp VARCHAR(6)
)
BEGIN
    DECLARE is_valid BOOLEAN;
    
    SELECT EXISTS (
        SELECT 1 FROM user_otps 
        WHERE user_id = p_user_id 
        AND otp = p_otp 
        AND is_used = 0
    ) INTO is_valid;
    
    IF is_valid THEN
        UPDATE user_otps 
        SET is_used = 1 
        WHERE user_id = p_user_id 
        AND otp = p_otp;
    END IF;
    
    SELECT is_valid as verified;
END$$
DELIMITER ;
