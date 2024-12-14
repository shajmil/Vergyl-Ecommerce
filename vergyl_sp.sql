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
CREATE DEFINER="avnadmin"@"%" PROCEDURE "add_product"(
    IN p_name VARCHAR(255),
    IN p_description TEXT,
    IN p_price DECIMAL(10, 2),
    IN p_stock INT,
    IN p_category VARCHAR(100),
    IN p_admin_id INT
)
BEGIN
    -- Insert product
    INSERT INTO products (
        name, description, price, stock, category, 
        created_at
    )
    VALUES (
        p_name, p_description, p_price, p_stock, p_category,
        NOW()
    );
    
    -- Return created product
    SELECT 
        p.*
    FROM products p
    WHERE p.product_id = LAST_INSERT_ID();
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
    IN p_items JSON,
    IN p_delivery_time DATETIME
)
BEGIN
    DECLARE v_order_id INT;
    DECLARE v_total DECIMAL(10, 2);
    
    START TRANSACTION;
    
    -- Calculate total from items
    SET v_total = (
        SELECT SUM(JSON_EXTRACT(item, '$.price') * JSON_EXTRACT(item, '$.quantity'))
        FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
            price DECIMAL(10, 2) PATH '$.price',
            quantity INT PATH '$.quantity'
        )) as items
    );
    
    -- Create order
    INSERT INTO orders (user_id, address_id, status, scheduled_time, total, created_at)
    VALUES (p_user_id, p_address_id, 'Pending', p_delivery_time, v_total, NOW());
    
    SET v_order_id = LAST_INSERT_ID();
    
    -- Insert order items
    INSERT INTO order_items (order_id, product_id, quantity, price, subtotal)
    SELECT 
        v_order_id,
        JSON_EXTRACT(item, '$.product_id'),
        JSON_EXTRACT(item, '$.quantity'),
        JSON_EXTRACT(item, '$.price'),
        JSON_EXTRACT(item, '$.price') * JSON_EXTRACT(item, '$.quantity')
    FROM JSON_TABLE(p_items, '$[*]' COLUMNS (
        item JSON PATH '$'
    )) as items;
    
    -- Update product stock
    UPDATE products p
    JOIN JSON_TABLE(p_items, '$[*]' COLUMNS (
        product_id INT PATH '$.product_id',
        quantity INT PATH '$.quantity'
    )) as items
    SET p.stock = p.stock - items.quantity
    WHERE p.product_id = items.product_id;
    
    COMMIT;
    
    -- Return order details
    SELECT o.*, 
           JSON_ARRAYAGG(
               JSON_OBJECT(
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'subtotal', oi.subtotal
               )
           ) as items
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.order_id = v_order_id
    GROUP BY o.order_id;
    
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
CREATE DEFINER="avnadmin"@"%" PROCEDURE "delete_product"(
    IN p_product_id INT,
    IN p_admin_id INT
)
BEGIN
    DELETE FROM products
    WHERE product_id = p_product_id;
    
    SELECT ROW_COUNT() as deleted;
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
    IN p_order_id INT,
    IN p_user_id INT
)
BEGIN
    -- Order details
    SELECT 
        o.*,
        a.address_line,
        a.city,
        a.state
    FROM orders o
    JOIN addresses a ON o.address_id = a.address_id
    WHERE o.order_id = p_order_id AND o.user_id = p_user_id;
    
    -- Order items
    SELECT 
        oi.*,
        p.name as product_name,
        p.description as product_description
    FROM order_items oi
    JOIN products p ON oi.product_id = p.product_id
    WHERE oi.order_id = p_order_id;
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
    SELECT 
        o.*,
        a.address_line,
        a.city,
        a.state,
        COUNT(oi.order_item_id) as item_count,
        SUM(oi.quantity) as total_items
    FROM orders o
    JOIN addresses a ON o.address_id = a.address_id
    JOIN order_items oi ON o.order_id = oi.order_id
    WHERE o.user_id = p_user_id
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
CREATE DEFINER="avnadmin"@"%" PROCEDURE "get_products"(
    IN p_category VARCHAR(100),
    IN p_search VARCHAR(255),
    IN p_limit INT,
    IN p_offset INT
)
BEGIN
    -- Get total count first
    SELECT COUNT(*) as total
    FROM products p
    WHERE (p_category IS NULL OR p.category = p_category)
    AND (p_search IS NULL 
         OR p.name LIKE CONCAT('%', p_search, '%')
         OR p.description LIKE CONCAT('%', p_search, '%'));

    -- Get paginated results
    SELECT 
        p.*,
        p.category as category_name
    FROM products p
    WHERE (p_category IS NULL OR p.category = p_category)
    AND (p_search IS NULL 
         OR p.name LIKE CONCAT('%', p_search, '%')
         OR p.description LIKE CONCAT('%', p_search, '%'))
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset;
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
CREATE DEFINER="avnadmin"@"%" PROCEDURE "update_product"(
    IN p_product_id INT,
    IN p_name VARCHAR(255),
    IN p_description TEXT,
    IN p_price DECIMAL(10, 2),
    IN p_stock INT,
    IN p_category VARCHAR(100),
    IN p_admin_id INT
)
BEGIN
    -- Update product
    UPDATE products
    SET name = p_name,
        description = p_description,
        price = p_price,
        stock = p_stock,
        category = p_category,
        updated_at = NOW()
    WHERE product_id = p_product_id;
    
    SELECT ROW_COUNT() as updated;
    
    IF ROW_COUNT() > 0 THEN
        SELECT 
            p.*
        FROM products p
        WHERE p.product_id = p_product_id;
    END IF;
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
