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
    -- Step 1: Insert Order
    DECLARE order_id_ INT;
  
    
    -- Step 2: Insert Order Items from JSON
    -- Iterate over the array of order items (either custom or predefined)
    DECLARE item_count INT DEFAULT 0;
    DECLARE item_json JSON;
    DECLARE is_custom_product_ tinyINT;
    DECLARE product_id INT;
    DECLARE product_request_id INT;
    DECLARE quantity INT;
    DECLARE price DECIMAL(10,2);

    SET item_count = JSON_LENGTH(p_order_items);
	INSERT INTO orders (user_id, address_id, subtotal, service_charge, delivery_charge, total)
    VALUES (p_user_id, p_address_id, p_subtotal, p_service_charge, p_delivery_charge, p_total);
    
    -- Get the newly created order's ID
    SET order_id_ = LAST_INSERT_ID();
    WHILE item_count > 0 DO
        SET item_json = JSON_EXTRACT(p_order_items, CONCAT('$[', item_count - 1, ']'));
        
        -- Extract item details from JSON
        SET is_custom_product_ = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.is_custom_product'));
        SET product_id = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_id'));
        SET product_request_id = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_request_id'));
        SET quantity = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.quantity'));
        SET price = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.price'));
        
        -- Insert the order item based on whether it's a custom product or not
        IF is_custom_product_ = 1 THEN
            INSERT INTO order_items (order_id, is_custom_product, product_request_id, quantity, price)
            VALUES (order_id_, TRUE, product_request_id, quantity, price);
            UPDATE product_requests
            SET status = 'Completed', updated_at = NOW()
            WHERE request_id = product_request_id;
        ELSE
            INSERT INTO order_items (order_id, is_custom_product, product_id, quantity, price)
            VALUES (order_id_, 0, product_id, quantity, price);
        END IF;
        
        -- Decrease item_count
        SET item_count = item_count - 1;
    END WHILE;
    
    INSERT INTO order_history (order_id, status, updated_at)
    VALUES (order_id_, 'Pending', NOW());
      SELECT order_id_ AS order_id;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "create_order_with_items"(
    IN p_user_id INT,
    IN p_address_id INT,
    IN p_subtotal DECIMAL(10,2),
    IN p_service_charge DECIMAL(10,2),
    IN p_delivery_charge DECIMAL(10,2),
    IN p_total DECIMAL(10,2),
    IN p_order_items JSON -- Array of items (either custom or predefined products)
)
BEGIN
    -- Step 1: Insert Order
    DECLARE order_id_ INT;
  
    
    -- Step 2: Insert Order Items from JSON
    -- Iterate over the array of order items (either custom or predefined)
    DECLARE item_count INT DEFAULT 0;
    DECLARE item_json JSON;
    DECLARE is_custom_product BOOLEAN;
    DECLARE product_id INT;
    DECLARE product_request_id INT;
    DECLARE quantity INT;
    DECLARE price DECIMAL(10,2);

    SET item_count = JSON_LENGTH(p_order_items);
	INSERT INTO orders (user_id, address_id, subtotal, service_charge, delivery_charge, total)
    VALUES (p_user_id, p_address_id, p_subtotal, p_service_charge, p_delivery_charge, p_total);
    
    -- Get the newly created order's ID
    SET order_id_ = LAST_INSERT_ID();
    WHILE item_count > 0 DO
        SET item_json = JSON_EXTRACT(p_order_items, CONCAT('$[', item_count - 1, ']'));
        
        -- Extract item details from JSON
        SET is_custom_product = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.is_custom_product'));
        SET product_id = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_id'));
        SET product_request_id = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.product_request_id'));
        SET quantity = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.quantity'));
        SET price = JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.price'));
        
        -- Insert the order item based on whether it's a custom product or not
        IF is_custom_product THEN
            INSERT INTO order_items (order_id, is_custom_product, product_request_id, quantity, price)
            VALUES (order_id_, TRUE, product_request_id, quantity, price);
        ELSE
            INSERT INTO order_items (order_id, is_custom_product, product_id, quantity, price)
            VALUES (order_id_, FALSE, product_id, quantity, price);
        END IF;
        
        -- Decrease item_count
        SET item_count = item_count - 1;
    END WHILE;
    
    INSERT INTO order_history (order_id, status, updated_at)
    VALUES (order_id_, 'Pending', NOW());
    
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "create_product_request"(
    IN p_user_id INT,
    IN p_product_name VARCHAR(255),
    IN p_description TEXT,
    IN p_requested_size VARCHAR(50),
    IN p_requested_color VARCHAR(50)
)
BEGIN
    INSERT INTO product_requests (user_id, product_name, description, requested_size, requested_color)
    VALUES (p_user_id, p_product_name, p_description, p_requested_size, p_requested_color);
        SELECT LAST_INSERT_ID() as request_id;

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
    IN p_order_id INT
)
BEGIN
    UPDATE orders
    SET delete_status = 1
    WHERE order_id = p_order_id;
    
    UPDATE order_items
    SET delete_status = 1
    WHERE order_id = p_order_id;
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
    IN p_status ENUM('Pending', 'Processed', 'Shipped', 'Delivered', 'Canceled'),
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    -- Your procedure logic goes here
    SELECT 
        o.order_id,
        o.user_id,
        o.address_id,
        o.subtotal,
        o.service_charge,
        o.delivery_charge,
        o.total,
        o.status,
        o.scheduled_time,
        o.created_at
    FROM orders o
    WHERE 
        (p_status IS NULL OR o.status = p_status)  -- Filter by status if provided
        AND (p_start_date IS NULL OR o.created_at >= p_start_date)  -- Filter by start date if provided
        AND (p_end_date IS NULL OR o.created_at <= p_end_date)  -- Filter by end date if provided
        AND o.delete_status = 0  -- Exclude deleted orders
    ORDER BY o.created_at DESC
    LIMIT p_limit OFFSET p_offset;

    -- Query to get the total sum of all orders' total
    SELECT SUM(o.total) AS total_amount
    FROM orders o
    WHERE 
        (p_status IS NULL OR o.status = p_status)  -- Filter by status if provided
        AND (p_start_date IS NULL OR o.created_at >= p_start_date)  -- Filter by start date if provided
        AND (p_end_date IS NULL OR o.created_at <= p_end_date)  -- Filter by end date if provided
        AND o.delete_status = 0;  -- Exclude deleted orders
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_all_product_requests"(
    IN p_status varchar(50) -- Add status as a filter parameter
)
BEGIN
    SELECT pr.request_id, 
           pr.product_name, 
           pr.description, 
           pr.requested_size, 
           pr.requested_color, 
           pr.status, 
           pr.admin_price, 
           pr.admin_size, 
           pr.admin_color, 
           pr.created_at, 
           pr.updated_at, 
           u.name AS customer_name, 
           u.email AS customer_email
    FROM product_requests pr
    LEFT JOIN users u ON pr.user_id = u.user_id
    WHERE pr.delete_status = 0
    AND (pr.status = p_status OR p_status IS NULL);  -- Filter by status if provided, else fetch all
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
    IN p_status varchar(50) -- Add status as a filter parameter
)
BEGIN
    SELECT pr.request_id, 
           pr.product_name, 
           pr.description, 
           pr.requested_size, 
           pr.requested_color, 
           pr.status, 
           pr.admin_price, 
           pr.admin_size, 
           pr.admin_color, 
           pr.created_at, 
           pr.updated_at
    FROM product_requests pr
    WHERE pr.user_id = p_user_id
      AND pr.delete_status = 0
      AND (pr.status = p_status OR p_status IS NULL);  -- Filter by status if provided, else fetch all
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
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_orders"(
    IN p_user_id INT
)
BEGIN
    -- Fetch orders for a specific user
    SELECT o.order_id, o.subtotal, o.service_charge, o.delivery_charge, o.total, o.status, o.created_at
    FROM orders o
    WHERE o.user_id = p_user_id
      AND o.delete_status = 0;  -- Filter out deleted orders
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
        o.scheduled_time,
        o.created_at
    FROM orders o
    WHERE o.order_id = p_order_id
      AND o.delete_status = 0;  -- Filter out deleted orders

    -- Fetch associated order items
    SELECT 
        oi.order_item_id,
        oi.product_id,
        oi.is_custom_product,
        oi.product_request_id,
        oi.quantity,
        oi.price,
        oi.subtotal AS item_subtotal,
        -- Conditional query for custom or predefined products
        CASE 
            WHEN oi.is_custom_product = 1 THEN (
                SELECT JSON_OBJECT(
                    'request_id', pr.request_id,
                    'user_id', pr.user_id,
                    'product_name', pr.product_name,
                    'description', pr.description,
                    'requested_size', pr.requested_size,
                    'requested_color', pr.requested_color,
                    'status', pr.status,
                    'admin_price', pr.admin_price,
                    'admin_size', pr.admin_size,
                    'admin_color', pr.admin_color,
                    'created_at', pr.created_at,
                    'updated_at', pr.updated_at,
                    'delete_status', pr.delete_status,
                    'approved_by', pr.approved_by
                )
                FROM product_requests pr
                WHERE pr.request_id = oi.product_request_id
                  AND pr.delete_status = 0
            )
            ELSE (
                SELECT JSON_OBJECT(
                    'product_id', p.product_id,
                    'name', p.name,
                    'category', p.category,
                    'price', p.price
                )
                FROM products p
                WHERE p.product_id = oi.product_id
                  AND p.delete_status = 0
            )
        END AS product_details
    FROM order_items oi
    WHERE oi.order_id = p_order_id
      AND oi.delete_status = 0;  -- Filter out deleted items
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
    SELECT user_id, name, email, phone, role, created_at
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
    IN p_action VARCHAR(10),          -- 'approve' or 'reject'
    IN p_admin_price DECIMAL(10,2),   -- Price when approving
    IN p_admin_size VARCHAR(50),      -- Size when approving
    IN p_admin_color VARCHAR(50)      -- Color when approving
)
BEGIN
    DECLARE affected_rows INT;

    -- Check if action is approve
    IF p_action = 'approve' THEN
        UPDATE product_requests
        SET status = 'Approved', 
            admin_price = p_admin_price, 
            admin_size = p_admin_size,
            admin_color = p_admin_color,
            approved_by = p_admin_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE request_id = p_request_id;
        
        -- Get the number of affected rows
        SET affected_rows = ROW_COUNT();
        
        -- If no rows were affected, signal an error
        IF affected_rows = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Request ID not found or no changes made.';
        END IF;

    -- If action is reject
    ELSEIF p_action = 'reject' THEN
        UPDATE product_requests
        SET status = 'Rejected', 
            updated_at = CURRENT_TIMESTAMP
        WHERE request_id = p_request_id;
        
        -- Get the number of affected rows
        SET affected_rows = ROW_COUNT();
        
        -- If no rows were affected, signal an error
        IF affected_rows = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Request ID not found or no changes made.';
        END IF;

    -- Invalid action handling
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid action. Please specify "approve" or "reject"';
    END IF;

    -- Return the request_id or affected rows count
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
    IN p_new_status ENUM('Pending', 'Processed', 'Shipped', 'Delivered', 'Canceled'),
    IN updated_By_ INT
)
BEGIN
    -- Update the order status in the orders table
    UPDATE orders
    SET status = p_new_status, 
        updated_at = NOW()
    WHERE order_id = p_order_id AND delete_status = 0;

    -- Insert a new record in the order_history table to track the status change
    INSERT INTO order_history (order_id, status,updated_By)
    VALUES (p_order_id, p_new_status,updated_By_);
    select p_order_id as order_id,p_new_status as status;
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
